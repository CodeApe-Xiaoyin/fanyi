import type { BilingualCue, Cue } from '@/domain/models/Cue';
import type { IAuthGate } from '@/domain/ports/IAuthGate';
import type { ICache } from '@/domain/ports/ICache';
import type { ISubtitleSource } from '@/domain/ports/ISubtitleSource';
import type { ITelemetry } from '@/domain/ports/ITelemetry';
import type { TimestampAllocator } from '@/domain/services/TimestampAllocator';
import type { SmartSegmentationUseCase } from '@/domain/use-cases/SmartSegmentationUseCase';
import type { TranslateBatchUseCase } from '@/domain/use-cases/TranslateBatchUseCase';
import type { AppSettings, VideoContext } from '@/shared/types';

interface SubtitlePipelineDeps {
  auth: IAuthGate;
  cache: ICache<BilingualCue[]>;
  subtitleSource: ISubtitleSource;
  segmentation: SmartSegmentationUseCase;
  translation: TranslateBatchUseCase;
  allocator: TimestampAllocator;
  telemetry: ITelemetry;
}

export class SubtitlePipelineUseCase {
  constructor(private readonly deps: SubtitlePipelineDeps) {}

  async run(
    video: VideoContext,
    settings: AppSettings,
  ): Promise<BilingualCue[]> {
    return this.runWithSource(video, settings);
  }

  async runWithSource(
    video: VideoContext,
    settings: AppSettings,
    preloadedSource?: {
      cues: Cue[];
      sourceLanguage: string;
    },
  ): Promise<BilingualCue[]> {
    const allowed = await this.deps.auth.isAllowed(video);
    if (!allowed) {
      throw new Error('当前视频暂不允许处理。');
    }

    const cacheKey = buildSubtitleCacheKey(video, settings);
    const cached = await this.deps.cache.get(cacheKey);
    if (cached) {
      await this.deps.telemetry.track('pipeline.cache_hit', {
        videoId: video.videoId,
      });
      return cached;
    }

    const fetched =
      preloadedSource ?? (await this.deps.subtitleSource.fetch(video));
    if (!Array.isArray(fetched.cues) || fetched.cues.length === 0) {
      throw new Error('未获取到有效字幕内容，已停止后续处理。');
    }

    const sentences = await this.deps.segmentation.execute(video, fetched.cues);
    const translations = await this.deps.translation.execute({
      video,
      sentences,
      targetLanguage: settings.targetLanguage,
    });
    const allocated = this.deps.allocator.allocate({
      cues: fetched.cues,
      sentences,
      translations,
    });

    await this.deps.cache.put(cacheKey, allocated);
    await this.deps.telemetry.track('pipeline.completed', {
      videoId: video.videoId,
      cueCount: fetched.cues.length,
      sentenceCount: sentences.length,
    });

    return allocated;
  }
}

export function buildSubtitleCacheKey(
  video: VideoContext,
  settings: AppSettings,
): string {
  const activeProvider = settings.llm.providers.find(
    (provider) => provider.id === settings.llm.activeProviderId,
  );
  const model = activeProvider
    ? 'model' in activeProvider
      ? activeProvider.model
      : activeProvider.name
    : 'unknown-model';

  return [
    video.videoId,
    model,
    settings.targetLanguage,
    settings.style.zhFontSizePercent,
    settings.style.enFontSizePercent,
    settings.style.lineOrder,
    settings.style.bottomOffsetPercent,
  ].join(':');
}
