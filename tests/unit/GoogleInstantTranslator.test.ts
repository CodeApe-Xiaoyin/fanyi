import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleInstantTranslator } from '@/infrastructure/translate/GoogleInstantTranslator';

describe('GoogleInstantTranslator', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('extracts the translation text from the gtx response array', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [[['你好世界', 'hello world', null, null, 1]], null, 'en'],
    });

    const translator = new GoogleInstantTranslator();
    const result = await translator.translate({
      text: 'hello world',
      sourceLanguage: 'en',
      targetLanguage: 'zh-CN',
    });

    expect(result).toBe('你好世界');
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('client=gtx');
    expect(calledUrl).toContain('sl=en');
    expect(calledUrl).toContain('tl=zh-CN');
  });

  it('joins multiple sentence rows so long captions stay intact', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [
          ['你好。', 'hello.', null, null, 1],
          ['今天怎么样？', 'how are you today?', null, null, 1],
        ],
        null,
        'en',
      ],
    });

    const translator = new GoogleInstantTranslator();
    const result = await translator.translate({
      text: 'hello. how are you today?',
      targetLanguage: 'zh-CN',
    });

    expect(result).toBe('你好。今天怎么样？');
  });

  it('throws on non-2xx so the caller can fall back to AI translation', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    const translator = new GoogleInstantTranslator();
    await expect(
      translator.translate({ text: 'rate limited', targetLanguage: 'zh-CN' }),
    ).rejects.toThrow(/429/);
  });

  it('returns empty string for empty input without hitting the network', async () => {
    const translator = new GoogleInstantTranslator();
    const result = await translator.translate({ text: '   ', targetLanguage: 'zh-CN' });

    expect(result).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
