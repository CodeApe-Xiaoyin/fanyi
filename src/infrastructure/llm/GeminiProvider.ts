import type {
  ChatRequest,
  ChatResponse,
  ILLMProvider,
} from '@/domain/ports/ILLMProvider';
import type { ProviderConfig } from '@/shared/types';

import {
  normalizeModelPath,
  parseJsonResponse,
  safeJsonParse,
} from './provider-helpers';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
}

export class GeminiProvider implements ILLMProvider {
  readonly id: string;

  readonly capabilities = {
    streaming: false,
    jsonMode: true,
    maxContextTokens: 1000000,
    supportsSystemPrompt: true,
  };

  constructor(
    private readonly config: Extract<ProviderConfig, { type: 'gemini' }>,
  ) {
    this.id = config.id;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = normalizeModelPath(request.model || this.config.model);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: request.system
          ? {
              parts: [{ text: request.system }],
            }
          : undefined,
        contents: request.messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens,
          responseMimeType: request.jsonSchema ? 'application/json' : 'text/plain',
        },
      }),
    });

    const { payload } = await parseJsonResponse<GeminiResponse>(
      response,
      'Gemini provider',
    );
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Gemini request failed: ${response.status}`);
    }

    const text =
      payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    if (!text && payload.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the response: ${payload.promptFeedback.blockReason}`);
    }

    return {
      text,
      json: safeJsonParse(text),
      raw: payload,
    };
  }
}
