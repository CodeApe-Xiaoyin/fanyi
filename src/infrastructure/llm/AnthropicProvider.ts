import type {
  ChatRequest,
  ChatResponse,
  ILLMProvider,
} from '@/domain/ports/ILLMProvider';
import type { ProviderConfig } from '@/shared/types';

import { buildEndpoint, parseJsonResponse, safeJsonParse } from './provider-helpers';

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
}

export class AnthropicProvider implements ILLMProvider {
  readonly id: string;

  readonly capabilities = {
    streaming: false,
    jsonMode: true,
    maxContextTokens: 200000,
    supportsSystemPrompt: true,
  };

  constructor(
    private readonly config: Extract<ProviderConfig, { type: 'anthropic' }>,
  ) {
    this.id = config.id;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const endpoint = buildEndpoint(
      this.config.baseURL ?? 'https://api.anthropic.com',
      '/v1/messages',
    );
    const system = request.jsonSchema
      ? [request.system, 'Respond with valid JSON only. Do not wrap the result in markdown.']
          .filter(Boolean)
          .join('\n\n')
      : request.system;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model || this.config.model,
        system,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    const { payload } = await parseJsonResponse<AnthropicResponse>(
      response,
      'Anthropic provider',
    );
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Anthropic request failed: ${response.status}`);
    }

    const text =
      payload.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('') ?? '';

    return {
      text,
      json: safeJsonParse(text),
      raw: payload,
    };
  }
}
