import { describe, expect, it } from 'vitest';

import { PromptBuilder } from '@/domain/services/PromptBuilder';

describe('PromptBuilder', () => {
  it('includes title and target language in translation prompts', () => {
    const builder = new PromptBuilder();
    const prompt = builder.buildTranslationPrompt({
      video: {
        videoId: 'abc',
        title: 'Building Fanyi',
      },
      sentences: [
        {
          id: 'sentence-1',
          text: 'We build with care.',
          cueIndexes: [0],
          start: 0,
          end: 1,
        },
      ],
      targetLanguage: 'zh-CN',
    });

    expect(prompt.system).toContain('Building Fanyi');
    expect(prompt.system).toContain('zh-CN');
  });
});
