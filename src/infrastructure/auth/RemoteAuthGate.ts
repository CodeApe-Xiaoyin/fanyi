import type { IAuthGate } from '@/domain/ports/IAuthGate';
import type { VideoContext } from '@/shared/types';

export class RemoteAuthGate implements IAuthGate {
  async isAllowed(_video: VideoContext): Promise<boolean> {
    throw new Error('Remote auth is not available in the local MVP build.');
  }
}
