import type { Cue } from '@/domain/models/Cue';
import type { ISubtitleSource } from '@/domain/ports/ISubtitleSource';
import type { CaptionTrack, VideoContext } from '@/shared/types';

import {
  buildTimedtextTrackCandidates,
  buildTimedtextUrlVariants,
  parseTimedtextPayload,
} from './timedtext-helpers';

export class TimedtextFetcher implements ISubtitleSource {
  async fetch(video: VideoContext): Promise<{ cues: Cue[]; sourceLanguage: string }> {
    const tracks = buildTimedtextTrackCandidates({
      captionTrack: video.captionTrack,
      captionTracks: video.captionTracks,
    });

    if (tracks.length === 0) {
      throw new Error('当前视频没有可用的字幕轨。');
    }

    let lastError: string | null = null;

    for (const track of tracks) {
      try {
        const cues = await fetchTrack(track);
        return {
          cues,
          sourceLanguage: track.languageCode,
        };
      } catch (error) {
        lastError = `${track.languageCode}${track.kind === 'asr' ? ' (auto)' : ''}: ${
          error instanceof Error ? error.message : '字幕抓取失败'
        }`;
      }
    }

    throw new Error(lastError ? `字幕抓取失败：${lastError}` : '字幕抓取失败。');
  }
}

async function fetchTrack(track: CaptionTrack): Promise<Cue[]> {
  let lastError: string | null = null;

  for (const url of buildTimedtextUrlVariants(track.baseUrl, track)) {
    const response = await fetch(url);
    if (!response.ok) {
      lastError = `HTTP ${response.status}`;
      continue;
    }

    const rawText = await response.text();
    try {
      const cues = parseTimedtextPayload(rawText);
      if (cues.length > 0) {
        return cues;
      }
      lastError = '没有解析出有效字幕内容。';
    } catch (error) {
      lastError = error instanceof Error ? error.message : '字幕解析失败。';
    }
  }

  throw new Error(lastError ?? '字幕轨尝试失败。');
}
