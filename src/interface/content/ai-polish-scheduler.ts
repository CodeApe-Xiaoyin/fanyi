import type { BilingualCue } from '@/domain/models/Cue';
import { appendDebugLog, summarizeUnknown } from '@/shared/debug-log';
import type {
  AiPolishBatchItem,
  AppSettings,
  VideoContext,
} from '@/shared/types';

import { requestAiPolishBatch, requestSubtitleCachePut } from './messaging';

const AI_POLISH_BATCH_SIZE = 32;
const AI_POLISH_CONCURRENCY = 2;
const AI_POLISH_PRIORITY_WINDOW_SEC = 180;
const AI_POLISH_SEEK_DEBOUNCE_MS = 600;
const AI_POLISH_CACHE_DEBOUNCE_MS = 2500;
const AI_POLISH_MAX_ATTEMPTS = 2;

interface SentencePolishUnit {
  sentenceId: string;
  cueIndexes: number[];
  sourceText: string;
  draftTranslation: string;
  start: number;
  end: number;
}

interface AiPolishSchedulerOptions {
  videoContext: VideoContext;
  video: HTMLVideoElement;
  settings: AppSettings;
  initialCues: BilingualCue[];
  isCurrentRun: () => boolean;
  onUpdate: (cues: BilingualCue[]) => void;
}

export class AiPolishScheduler {
  private cues: BilingualCue[];

  private readonly units: SentencePolishUnit[];

  private readonly unitsById = new Map<string, SentencePolishUnit>();

  private readonly polishedIds = new Set<string>();

  private readonly inFlightIds = new Set<string>();

  private readonly attempts = new Map<string, number>();

  private pendingIds: string[] = [];

  private inFlightBatches = 0;

  private stopped = false;

  private seekTimer: number | null = null;

  private cacheTimer: number | null = null;

  private readonly onSeek = (): void => {
    this.scheduleReprioritize();
  };

  constructor(private readonly options: AiPolishSchedulerOptions) {
    this.cues = options.initialCues.map((cue) => ({ ...cue }));
    this.units = buildSentenceUnits(this.cues);
    this.units.forEach((unit) => {
      this.unitsById.set(unit.sentenceId, unit);
      if (
        unit.cueIndexes.every(
          (cueIndex) =>
            this.cues[cueIndex]?.translationSource === 'ai-polished',
        )
      ) {
        this.polishedIds.add(unit.sentenceId);
      }
    });
  }

  start(): void {
    if (!this.hasActiveProvider()) {
      void appendDebugLog({
        level: 'info',
        source: 'content',
        event: 'ai-polish.skip-no-provider',
        details: '未配置激活的 AI Provider，保持 Google 快速翻译。',
      });
      return;
    }

    if (this.units.length === 0) {
      return;
    }

    this.options.video.addEventListener('seeking', this.onSeek);
    this.options.video.addEventListener('seeked', this.onSeek);
    this.rebuildPending(this.options.video.currentTime);
    this.pump();

    void appendDebugLog({
      level: 'info',
      source: 'content',
      event: 'ai-polish.start',
      details: summarizeUnknown({
        sentenceCount: this.units.length,
        alreadyPolished: this.polishedIds.size,
        batchSize: AI_POLISH_BATCH_SIZE,
        concurrency: AI_POLISH_CONCURRENCY,
      }),
    });
  }

  stop(): void {
    this.stopped = true;
    this.options.video.removeEventListener('seeking', this.onSeek);
    this.options.video.removeEventListener('seeked', this.onSeek);

    if (this.seekTimer !== null) {
      window.clearTimeout(this.seekTimer);
      this.seekTimer = null;
    }

    if (this.cacheTimer !== null) {
      window.clearTimeout(this.cacheTimer);
      this.cacheTimer = null;
    }
  }

  private hasActiveProvider(): boolean {
    return Boolean(
      this.options.settings.llm.activeProviderId &&
        this.options.settings.llm.providers.some(
          (provider) =>
            provider.id === this.options.settings.llm.activeProviderId,
        ),
    );
  }

  private scheduleReprioritize(): void {
    if (this.stopped) return;

    if (this.seekTimer !== null) {
      window.clearTimeout(this.seekTimer);
    }

    this.seekTimer = window.setTimeout(() => {
      this.seekTimer = null;
      this.rebuildPending(this.options.video.currentTime);
      this.pump();

      void appendDebugLog({
        level: 'info',
        source: 'content',
        event: 'ai-polish.seek-reprioritize',
        details: summarizeUnknown({
          currentTime: this.options.video.currentTime,
          pending: this.pendingIds.length,
          polished: this.polishedIds.size,
        }),
      });
    }, AI_POLISH_SEEK_DEBOUNCE_MS);
  }

  private rebuildPending(referenceTime: number): void {
    this.pendingIds = this.units
      .filter((unit) => this.isEligible(unit))
      .sort((left, right) =>
        comparePriority(left, right, referenceTime),
      )
      .map((unit) => unit.sentenceId);
  }

  private isEligible(unit: SentencePolishUnit): boolean {
    if (this.polishedIds.has(unit.sentenceId)) return false;
    if (this.inFlightIds.has(unit.sentenceId)) return false;
    return (this.attempts.get(unit.sentenceId) ?? 0) < AI_POLISH_MAX_ATTEMPTS;
  }

  private pump(): void {
    if (this.stopped || !this.options.isCurrentRun()) return;

    while (
      this.inFlightBatches < AI_POLISH_CONCURRENCY &&
      this.pendingIds.length > 0
    ) {
      const batch = this.takeNextBatch();
      if (batch.length === 0) {
        break;
      }

      this.inFlightBatches += 1;
      void this.runBatch(batch).finally(() => {
        this.inFlightBatches -= 1;
        if (this.stopped || !this.options.isCurrentRun()) return;

        this.rebuildPending(this.options.video.currentTime);
        this.pump();

        if (this.pendingIds.length === 0 && this.inFlightBatches === 0) {
          this.saveCacheNow();
          void appendDebugLog({
            level: 'info',
            source: 'content',
            event: 'ai-polish.complete',
            details: summarizeUnknown({
              sentenceCount: this.units.length,
              polished: this.polishedIds.size,
            }),
          });
        }
      });
    }
  }

  private takeNextBatch(): SentencePolishUnit[] {
    const batch: SentencePolishUnit[] = [];

    while (
      batch.length < AI_POLISH_BATCH_SIZE &&
      this.pendingIds.length > 0
    ) {
      const sentenceId = this.pendingIds.shift();
      if (!sentenceId) continue;
      const unit = this.unitsById.get(sentenceId);
      if (!unit || !this.isEligible(unit)) continue;

      this.inFlightIds.add(unit.sentenceId);
      this.attempts.set(
        unit.sentenceId,
        (this.attempts.get(unit.sentenceId) ?? 0) + 1,
      );
      batch.push(unit);
    }

    return batch;
  }

  private async runBatch(batch: SentencePolishUnit[]): Promise<void> {
    try {
      const response = await requestAiPolishBatch({
        video: this.options.videoContext,
        sourceLanguage: this.options.videoContext.sourceLanguage,
        items: batch.map(toBatchItem),
      });

      if (!response.ok) {
        throw new Error(response.error);
      }

      const translationById = new Map(
        response.translations.map((item) => [
          item.sentenceId,
          item.translation.trim(),
        ]),
      );
      let updated = 0;

      for (const unit of batch) {
        const translation = translationById.get(unit.sentenceId);
        if (!translation) continue;

        for (const cueIndex of unit.cueIndexes) {
          this.cues[cueIndex] = {
            ...this.cues[cueIndex],
            translation,
            translationSource: 'ai-polished',
          };
        }
        unit.draftTranslation = translation;
        this.polishedIds.add(unit.sentenceId);
        updated += 1;
      }

      if (updated > 0 && this.options.isCurrentRun() && !this.stopped) {
        this.options.onUpdate(this.cues.map((cue) => ({ ...cue })));
        this.scheduleCacheSave();
      }

      void appendDebugLog({
        level: 'info',
        source: 'content',
        event: 'ai-polish.batch-applied',
        details: summarizeUnknown({
          requested: batch.length,
          updated,
          polished: this.polishedIds.size,
          total: this.units.length,
        }),
      });
    } catch (error) {
      void appendDebugLog({
        level: 'warn',
        source: 'content',
        event: 'ai-polish.batch-failed',
        details: summarizeUnknown({
          error,
          sentenceIds: batch.map((unit) => unit.sentenceId),
        }),
      });
    } finally {
      batch.forEach((unit) => this.inFlightIds.delete(unit.sentenceId));
    }
  }

  private scheduleCacheSave(): void {
    if (this.cacheTimer !== null) {
      return;
    }

    this.cacheTimer = window.setTimeout(() => {
      this.cacheTimer = null;
      this.saveCacheNow();
    }, AI_POLISH_CACHE_DEBOUNCE_MS);
  }

  private saveCacheNow(): void {
    if (this.stopped || !this.options.isCurrentRun()) return;

    void requestSubtitleCachePut({
      video: this.options.videoContext,
      cues: this.cues,
    }).catch((error) => {
      void appendDebugLog({
        level: 'warn',
        source: 'content',
        event: 'ai-polish.cache-save-failed',
        details: summarizeUnknown(error),
      });
    });
  }
}

function buildSentenceUnits(cues: BilingualCue[]): SentencePolishUnit[] {
  const units: SentencePolishUnit[] = [];
  const unitById = new Map<string, SentencePolishUnit>();

  cues.forEach((cue, index) => {
    const sentenceId = cue.sentenceId || cue.id;
    const existing = unitById.get(sentenceId);

    if (existing) {
      existing.cueIndexes.push(index);
      existing.sourceText = normalizeJoinedText(existing.sourceText, cue.text);
      existing.end = Math.max(existing.end, cue.end);
      return;
    }

    const unit: SentencePolishUnit = {
      sentenceId,
      cueIndexes: [index],
      sourceText: cue.text.trim(),
      draftTranslation: cue.translation.trim(),
      start: cue.start,
      end: cue.end,
    };
    unitById.set(sentenceId, unit);
    units.push(unit);
  });

  return units;
}

function normalizeJoinedText(left: string, right: string): string {
  return [left, right].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function toBatchItem(unit: SentencePolishUnit): AiPolishBatchItem {
  return {
    sentenceId: unit.sentenceId,
    sourceText: unit.sourceText,
    draftTranslation: unit.draftTranslation,
    start: unit.start,
    end: unit.end,
  };
}

function comparePriority(
  left: SentencePolishUnit,
  right: SentencePolishUnit,
  referenceTime: number,
): number {
  const leftRank = priorityRank(left, referenceTime);
  const rightRank = priorityRank(right, referenceTime);

  if (leftRank.bucket !== rightRank.bucket) {
    return leftRank.bucket - rightRank.bucket;
  }
  if (leftRank.distance !== rightRank.distance) {
    return leftRank.distance - rightRank.distance;
  }
  return left.start - right.start;
}

function priorityRank(
  unit: SentencePolishUnit,
  referenceTime: number,
): { bucket: number; distance: number } {
  if (
    unit.end >= referenceTime &&
    unit.start <= referenceTime + AI_POLISH_PRIORITY_WINDOW_SEC
  ) {
    return {
      bucket: 0,
      distance: Math.max(0, unit.start - referenceTime),
    };
  }

  if (unit.start > referenceTime + AI_POLISH_PRIORITY_WINDOW_SEC) {
    return {
      bucket: 1,
      distance: unit.start - referenceTime,
    };
  }

  return {
    bucket: 2,
    distance: unit.start,
  };
}
