export interface ITelemetry {
  track(event: string, payload?: Record<string, unknown>): Promise<void>;
}
