import type { VideoContext } from '@/shared/types';

export interface IAuthGate {
  isAllowed(video: VideoContext): Promise<boolean>;
}
