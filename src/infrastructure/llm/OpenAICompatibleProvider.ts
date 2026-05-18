import type {
  ChatRequest,
  ChatResponse,
  ILLMProvider,
} from '@/domain/ports/ILLMProvider';
import type { ProviderConfig } from '@/shared/types';

import { parseJsonResponse, safeJsonParse } from './provider-helpers';

export class OpenAICompatibleProvider implements ILLMProvider {
  readonly id: string;

  readonly capabilities = {
    streaming: false,
    jsonMode: true,
    maxContextTokens: 128000,
    supportsSystemPrompt: true,
  };

  constructor(private readonly config: Extract<ProviderConfig, { type: 'openai-compatible' }>) {
    this.id = config.id;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const endpoint = normalizeEndpoint(this.config.baseURL);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: request.model || this.config.model,
        messages: [
          ...(request.system ? [{ role: 'system', content: request.system }] : []),
          ...request.messages,
        ],
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens,
        response_format: request.jsonSchema ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Provider request failed with status ${response.status}`);
    }

    const { payload } = await parseJsonResponse<OpenAICompatibleResponse>(
      response,
      'OpenAI-compatible provider',
    );
    const content = extractContent(payload);

    return {
      text: content,
      json: safeJsonParse(content),
      raw: payload,
    };
  }
}

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type: string; text?: string }>;
    };
  }>;
}

function normalizeEndpoint(baseURL: string): string {
  const trimmed = baseURL.replace(/\/$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`;
  }

  return `${trimmed}/v1/chat/completions`;
}

function extractContent(payload: OpenAICompatibleResponse): string {
  const content = payload.choices?.[0]?.message?.content;

  if (Array.isArray(content)) {
    return content.map((item) => item.text ?? '').join('');
  }

  return content ?? '';
}
