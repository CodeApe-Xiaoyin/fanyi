import { describe, expect, it } from 'vitest';

import { TimestampAllocator } from '@/domain/services/TimestampAllocator';

describe('TimestampAllocator', () => {
  it('keeps the original cue timing and renders one bilingual cue per source cue', () => {
    const allocator = new TimestampAllocator();
    const allocated = allocator.allocate({
      cues: [
        { id: '1', start: 0, end: 1, text: 'Hello world' },
        { id: '2', start: 1, end: 2, text: 'from Fanyi' },
      ],
      sentences: [
        {
          id: 'sentence-1',
          text: 'Hello world from Fanyi',
          cueIndexes: [0, 1],
          start: 0,
          end: 2,
        },
      ],
      translations: [{ sentenceId: 'sentence-1', translation: '你好世界来自 Fanyi' }],
    });

    expect(allocated).toHaveLength(2);
    expect(allocated[0].start).toBe(0);
    expect(allocated[0].end).toBe(1);
    expect(allocated[1].start).toBe(1);
    expect(allocated[1].end).toBe(2);
    expect(allocated[1].wordTimings).toHaveLength(2);
  });

  it('shares the full sentence translation across every cue in that sentence', () => {
    // 这是修时间轴对不上的关键回归：之前会把译文按字符权重切成
    // "你好世" / "界来自 Fanyi"，造成中文字幕每两秒跳一次碎片。
    const allocator = new TimestampAllocator();
    const allocated = allocator.allocate({
      cues: [
        { id: '1', start: 0, end: 1, text: 'Hello world' },
        { id: '2', start: 1, end: 2, text: 'from Fanyi forever' },
      ],
      sentences: [
        {
          id: 'sentence-1',
          text: 'Hello world from Fanyi forever',
          cueIndexes: [0, 1],
          start: 0,
          end: 2,
        },
      ],
      translations: [{ sentenceId: 'sentence-1', translation: '你好世界，来自永远的 Fanyi' }],
    });

    expect(allocated[0].translation).toBe('你好世界，来自永远的 Fanyi');
    expect(allocated[1].translation).toBe('你好世界，来自永远的 Fanyi');
  });

  it('keeps cues even when no translation result is provided (falls back to source text)', () => {
    const allocator = new TimestampAllocator();
    const allocated = allocator.allocate({
      cues: [{ id: '1', start: 0, end: 1, text: 'Hello world' }],
      sentences: [
        {
          id: 'sentence-1',
          text: 'Hello world',
          cueIndexes: [0],
          start: 0,
          end: 1,
        },
      ],
      translations: [],
    });

    expect(allocated).toHaveLength(1);
    expect(allocated[0].translation).toBe('Hello world');
  });
});
