import type { IStorage } from '@/domain/ports/IStorage';

const memoryFallback = new Map<string, unknown>();

export class ChromeStorageAdapter implements IStorage {
  async get<T>(key: string, fallback: T): Promise<T> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return (memoryFallback.get(key) as T | undefined) ?? fallback;
    }

    const values = await chrome.storage.local.get(key);
    return (values[key] as T | undefined) ?? fallback;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      memoryFallback.set(key, value);
      return;
    }

    await chrome.storage.local.set({ [key]: value });
  }
}
