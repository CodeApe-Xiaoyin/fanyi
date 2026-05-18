export interface DebugLogRecord {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: 'content' | 'background' | 'shared';
  event: string;
  details?: string;
}

const LOG_STORAGE_KEY = 'fanyi:debug-logs';
const LOG_LIMIT = 200;

export async function appendDebugLog(
  input: Omit<DebugLogRecord, 'id' | 'timestamp'>,
): Promise<void> {
  const entry: DebugLogRecord = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    ...input,
  };

  console[input.level === 'error' ? 'error' : input.level === 'warn' ? 'warn' : 'info'](
    `[Fanyi][${input.source}] ${input.event}`,
    input.details ?? '',
  );

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  try {
    const current = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const logs = Array.isArray(current[LOG_STORAGE_KEY]) ? current[LOG_STORAGE_KEY] : [];
    const next = [...logs, entry].slice(-LOG_LIMIT);
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: next });
  } catch {
    // Logging must never block the main flow.
  }
}

export async function readDebugLogs(): Promise<DebugLogRecord[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return [];
  }

  const current = await chrome.storage.local.get(LOG_STORAGE_KEY);
  return Array.isArray(current[LOG_STORAGE_KEY]) ? current[LOG_STORAGE_KEY] : [];
}

export async function wipeDebugLogs(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.set({ [LOG_STORAGE_KEY]: [] });
}

export function summarizeUnknown(value: unknown, maxLength = 240): string {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  const text =
    typeof value === 'string'
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })();

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
