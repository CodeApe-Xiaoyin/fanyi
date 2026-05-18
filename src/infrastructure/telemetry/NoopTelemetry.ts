import type { ITelemetry } from '@/domain/ports/ITelemetry';

export class NoopTelemetry implements ITelemetry {
  async track(): Promise<void> {
    return Promise.resolve();
  }
}
