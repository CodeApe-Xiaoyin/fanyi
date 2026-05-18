import type { Cue } from '@/domain/models/Cue';
import type { VideoContext } from '@/shared/types';

export interface ISubtitleSource {
  fetch(video: VideoContext): Promise<{
    cues: Cue[];
    sourceLanguage: string;
  }>;
}
