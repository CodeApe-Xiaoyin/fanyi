import { describe, expect, it } from 'vitest';

import { OpenAICompatibleProvider } from '@/infrastructure/llm/OpenAICompatibleProvider';

describe('OpenAICompatibleProvider', () => {
  it('normalizes /v1 endpoints correctly', () => {
    const provider = new OpenAICompatibleProvider({
      type: 'openai-compatible',
      id: 'local',
      name: 'Local',
      baseURL: 'https://example.com/v1',
      apiKey: 'secret',
      model: 'gpt-test',
    });

    expect(provider.id).toBe('local');
  });
});
