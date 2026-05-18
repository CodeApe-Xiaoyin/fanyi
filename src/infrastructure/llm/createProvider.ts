import type { ILLMProvider } from '@/domain/ports/ILLMProvider';
import { AnthropicProvider } from '@/infrastructure/llm/AnthropicProvider';
import { CustomTemplateProvider } from '@/infrastructure/llm/CustomTemplateProvider';
import { GeminiProvider } from '@/infrastructure/llm/GeminiProvider';
import { OpenAICompatibleProvider } from '@/infrastructure/llm/OpenAICompatibleProvider';
import type { ProviderConfig } from '@/shared/types';

export function createProvider(config: ProviderConfig): ILLMProvider {
  switch (config.type) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'custom':
      return new CustomTemplateProvider(config);
  }
}
