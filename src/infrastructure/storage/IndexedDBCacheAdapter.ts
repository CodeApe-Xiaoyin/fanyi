import type { CacheEntrySummary, ICache } from '@/domain/ports/ICache';

const DB_NAME = 'fanyi-cache-db';
const STORE_NAME = 'subtitle-cache';

export class IndexedDBCacheAdapter<T> implements ICache<T> {
  async get(cacheKey: string): Promise<T | null> {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onsuccess = () => resolve((request.result?.value as T | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async put(cacheKey: string, value: T): Promise<void> {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      store.put({
        cacheKey,
        createdAt: new Date().toISOString(),
        value,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      store.clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async count(): Promise<number> {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async list(limit = 10): Promise<CacheEntrySummary[]> {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = ((request.result as Array<{ cacheKey: string; createdAt: string }>) ?? [])
          .map((entry) => ({
            cacheKey: entry.cacheKey,
            createdAt: entry.createdAt,
          }))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, limit);

        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
