import type { ITelemetry } from '@/domain/ports/ITelemetry';

export class RemoteTelemetry implements ITelemetry {
  async track(): Promise<void> {
    throw new Error('Remote telemetry is not available in the local MVP build.');
  }
}
