import type { IAuthGate } from '@/domain/ports/IAuthGate';
import type { VideoContext } from '@/shared/types';

export class LocalAuthGate implements IAuthGate {
  async isAllowed(_video: VideoContext): Promise<boolean> {
    return true;
  }
}
