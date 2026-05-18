import type { ILLMProvider, ChatRequest, ChatResponse } from '@/domain/ports/ILLMProvider';
import type { IStorage } from '@/domain/ports/IStorage';
import { DEFAULT_SETTINGS, STORAGE_KEYS, type AppSettings } from '@/shared/types';

import { createProvider } from './createProvider';

export class ProviderRegistry implements ILLMProvider {
  readonly id = 'provider-registry';

  readonly capabilities = {
    streaming: false,
    jsonMode: true,
    maxContextTokens: 128000,
    supportsSystemPrompt: true,
  };

  constructor(private readonly storage: IStorage) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const provider = await this.getActiveProvider();
    return provider.chat(request);
  }

  private async getActiveProvider(): Promise<ILLMProvider> {
    const settings = await this.storage.get<AppSettings>(
      STORAGE_KEYS.settings,
      DEFAULT_SETTINGS,
    );
    const active = settings.llm.providers.find(
      (provider) => provider.id === settings.llm.activeProviderId,
    );

    if (!active) {
      throw new Error('请先在 Options 页面配置并激活一个 LLM Provider。');
    }

    return createProvider(active);
  }
}
