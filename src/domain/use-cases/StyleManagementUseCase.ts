import type { IStorage } from '@/domain/ports/IStorage';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/types';

export class StyleManagementUseCase {
  constructor(private readonly storage: IStorage) {}

  async get(): Promise<typeof DEFAULT_SETTINGS.style> {
    const settings = await this.storage.get(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    return settings.style;
  }

  async update(patch: Partial<typeof DEFAULT_SETTINGS.style>): Promise<typeof DEFAULT_SETTINGS.style> {
    const settings = await this.storage.get(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    const next = {
      ...settings,
      style: {
        ...settings.style,
        ...patch,
      },
    };

    await this.storage.set(STORAGE_KEYS.settings, next);
    return next.style;
  }
}
