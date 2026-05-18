import type { BilingualCue } from '@/domain/models/Cue';
import type { SubtitleStyle } from '@/domain/models/SubtitleStyle';
import { appendDebugLog, summarizeUnknown } from '@/shared/debug-log';
import { toFriendlyErrorMessage } from '@/shared/error-messages';
import type { AppSettings, CaptionTrack, VideoContext } from '@/shared/types';

import { AiPolishScheduler } from './ai-polish-scheduler';
import { withTimeout } from './async-utils';
import { normalizeBilingualCueList } from './bilingual-cues';
import { requestPipeline } from './messaging';
import type { SourceSubtitleResult } from './source-subtitles';

export interface TranslatedSubtitles {
  cues: BilingualCue[];
  style: SubtitleStyle;
  videoContext: VideoContext;
}

export interface SubtitlePolishHandle {
  stop(): void;
}

export function getInitialTranslationLoadingMessage(cueCount: number): string {
  return cueCount > 1500
    ? `Fanyi 正在翻译 ${cueCount} 条字幕（长视频，约需 30 秒）...`
    : 'Fanyi 正在批量翻译...';
}

export async function translateSourceSubtitles(input: {
  context: VideoContext;
  selectedTrack?: CaptionTrack;
  sourceSubtitles: SourceSubtitleResult;
}): Promise<TranslatedSubtitles> {
  const videoContext: VideoContext = {
    ...input.context,
    captionTrack: input.selectedTrack,
    sourceLanguage: input.sourceSubtitles.sourceLanguage,
  };

  const result = await withTimeout(
    requestPipeline({
      video: videoContext,
      sourceSubtitles: input.sourceSubtitles,
    }),
    240000,
    '翻译超时（已超过 4 分钟）。可能 Google 翻译被网络拦截，请检查代理或换网络环境。',
  );

  void appendDebugLog({
    level: 'info',
    source: 'content',
    event: 'content.pipeline-response',
    details: summarizeUnknown(result),
  });

  if (!result.ok) {
    throw new Error(toFriendlyErrorMessage(result.error));
  }

  const normalizedCues = normalizeBilingualCueList(result.data.cues);
  if (!normalizedCues) {
    void appendDebugLog({
      level: 'error',
      source: 'content',
      event: 'content.invalid-cues-shape',
      details: summarizeUnknown(result.data.cues),
    });
    throw new Error('字幕结果结构异常，请先到 General 页面清空缓存后重试。');
  }

  return {
    cues: normalizedCues,
    style: result.data.style,
    videoContext,
  };
}

export function startAiPolish(input: {
  translated: TranslatedSubtitles;
  video: HTMLVideoElement;
  settings: AppSettings;
  isCurrentRun: () => boolean;
  onUpdate: (cues: BilingualCue[]) => void;
}): SubtitlePolishHandle {
  const scheduler = new AiPolishScheduler({
    videoContext: input.translated.videoContext,
    video: input.video,
    settings: input.settings,
    initialCues: input.translated.cues,
    isCurrentRun: input.isCurrentRun,
    onUpdate: input.onUpdate,
  });
  scheduler.start();
  return scheduler;
}
