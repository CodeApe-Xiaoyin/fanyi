export interface CacheEntry<T> {
  cacheKey: string;
  createdAt: string;
  value: T;
}

export interface CacheEntrySummary {
  cacheKey: string;
  createdAt: string;
}

export interface ICache<T> {
  get(cacheKey: string): Promise<T | null>;
  put(cacheKey: string, value: T): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
  list(limit?: number): Promise<CacheEntrySummary[]>;
}
