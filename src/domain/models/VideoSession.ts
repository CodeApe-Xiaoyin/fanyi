import type { Cue } from '@/domain/models/Cue';
import type { Sentence } from '@/domain/models/Sentence';
import type { VideoContext } from '@/shared/types';

export interface VideoSession {
  video: VideoContext;
  sourceCues: Cue[];
  sentences: Sentence[];
}
