const PREFIX = '[Fanyi]';

export const logger = {
  info(message: string, payload?: unknown): void {
    console.info(PREFIX, message, payload ?? '');
  },
  warn(message: string, payload?: unknown): void {
    console.warn(PREFIX, message, payload ?? '');
  },
  error(message: string, payload?: unknown): void {
    console.error(PREFIX, message, payload ?? '');
  },
};
