import { describe, expect, it } from 'vitest';

import { createProvider } from '@/infrastructure/llm/createProvider';

describe('createProvider', () => {
  it('creates an anthropic provider with the same id', () => {
    const provider = createProvider({
      type: 'anthropic',
      id: 'claude-main',
      name: 'Claude Main',
      apiKey: 'secret',
      model: 'claude-3-5-sonnet-latest',
      baseURL: 'https://api.anthropic.com',
    });

    expect(provider.id).toBe('claude-main');
    expect(provider.capabilities.supportsSystemPrompt).toBe(true);
  });

  it('creates a custom template provider', () => {
    const provider = createProvider({
      type: 'custom',
      id: 'custom-main',
      name: 'Custom Main',
      baseURL: 'https://example.com/llm',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      requestTemplate: '{"input":"{{lastUserMessage}}"}',
      responseExtractor: '$.data.output',
    });

    expect(provider.id).toBe('custom-main');
    expect(provider.capabilities.supportsSystemPrompt).toBe(false);
  });
});
