import { describe, expect, it } from 'vitest';

import { parseSubtitlePolishResponse } from '@/domain/services/SubtitlePolishResponseParser';

describe('parseSubtitlePolishResponse', () => {
  it('parses object translations by sentenceId', () => {
    const result = parseSubtitlePolishResponse(
      {
        translations: [
          { sentenceId: 'sentence-1', translation: '自然一点的译文' },
          { sentenceId: 'sentence-2', translation: '第二句译文' },
        ],
      },
      ['sentence-1', 'sentence-2'],
    );

    expect(result).toEqual([
      { sentenceId: 'sentence-1', translation: '自然一点的译文' },
      { sentenceId: 'sentence-2', translation: '第二句译文' },
    ]);
  });

  it('parses fenced JSON and ignores unknown ids', () => {
    const result = parseSubtitlePolishResponse(
      '```json\n{"translations":[{"sentenceId":"sentence-1","translation":"可用译文"},{"sentenceId":"other","translation":"忽略"}]}\n```',
      ['sentence-1'],
    );

    expect(result).toEqual([
      { sentenceId: 'sentence-1', translation: '可用译文' },
    ]);
  });

  it('maps string arrays to expected ids in order', () => {
    const result = parseSubtitlePolishResponse(
      { translations: ['第一句', '第二句'] },
      ['sentence-1', 'sentence-2'],
    );

    expect(result).toEqual([
      { sentenceId: 'sentence-1', translation: '第一句' },
      { sentenceId: 'sentence-2', translation: '第二句' },
    ]);
  });
});
