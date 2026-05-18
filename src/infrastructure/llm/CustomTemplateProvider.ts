import type {
  ChatRequest,
  ChatResponse,
  ILLMProvider,
} from '@/domain/ports/ILLMProvider';
import type { ProviderConfig } from '@/shared/types';

import {
  extractJsonPath,
  renderTemplate,
  safeJsonParse,
  unknownToText,
} from './provider-helpers';

export class CustomTemplateProvider implements ILLMProvider {
  readonly id: string;

  readonly capabilities = {
    streaming: false,
    jsonMode: false,
    maxContextTokens: 128000,
    supportsSystemPrompt: false,
  };

  constructor(private readonly config: Extract<ProviderConfig, { type: 'custom' }>) {
    this.id = config.id;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model || this.config.name;
    const body = renderTemplate(this.config.requestTemplate, request, model);
    const response = await fetch(this.config.baseURL, {
      method: this.config.method,
      headers: this.config.headers,
      body,
    });

    const rawText = await response.text();
    const rawJson = safeJsonParse(rawText);
    if (!response.ok) {
      throw new Error(`Custom provider request failed: ${response.status}`);
    }

    const extracted = this.config.responseExtractor
      ? extractJsonPath(rawJson ?? rawText, this.config.responseExtractor)
      : rawJson ?? rawText;

    if (extracted === undefined) {
      throw new Error('Custom provider responseExtractor did not match any value.');
    }

    const text = unknownToText(extracted);

    return {
      text,
      json: safeJsonParse(text),
      raw: rawJson ?? rawText,
    };
  }
}
