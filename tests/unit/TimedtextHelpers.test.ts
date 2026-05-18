import { describe, expect, it } from 'vitest';

import {
  buildTimedtextTrackCandidates,
  buildTimedtextUrl,
  buildTimedtextUrlVariants,
  parseTimedtextPayload,
} from '@/infrastructure/youtube/timedtext-helpers';

describe('timedtext-helpers', () => {
  it('preserves original params while forcing fmt=json3', () => {
    const result = buildTimedtextUrl(
      'https://www.youtube.com/api/timedtext?lang=en&xorb=2&fmt=srv3',
    );

    expect(result).toContain('lang=en');
    expect(result).toContain('xorb=2');
    expect(result).toContain('fmt=json3');
  });

  it('deduplicates track candidates while keeping the selected track first', () => {
    const tracks = buildTimedtextTrackCandidates({
      captionTrack: {
        baseUrl: 'https://example.com/a',
        languageCode: 'en',
        name: 'English',
      },
      captionTracks: [
        {
          baseUrl: 'https://example.com/a',
          languageCode: 'en',
          name: 'English',
        },
        {
          baseUrl: 'https://example.com/b',
          languageCode: 'en',
          name: 'English auto',
          kind: 'asr',
        },
      ],
    });

    expect(tracks).toHaveLength(2);
    expect(tracks[0].baseUrl).toBe('https://example.com/a');
  });

  it('adds missing ASR kind and language when building URL variants', () => {
    const urls = buildTimedtextUrlVariants(
      'https://www.youtube.com/api/timedtext?caps=asr',
      {
        languageCode: 'en',
        kind: 'asr',
      },
    );

    expect(urls[0]).toContain('kind=asr');
    expect(urls[0]).toContain('lang=en');
    expect(urls[0]).toContain('fmt=json3');
  });

  it('parses xml transcript responses', () => {
    const cues = parseTimedtextPayload(
      '<transcript><text start="1.5" dur="2.0">Hello &amp; world</text></transcript>',
    );

    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello & world');
    expect(cues[0].start).toBe(1.5);
  });

  it('parses srv3 transcript responses', () => {
    const cues = parseTimedtextPayload(
      '<timedtext><body><p t="2000" d="1200"><s t="0">Hello</s><s t="600">world</s></p></body></timedtext>',
    );

    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Helloworld');
    expect(cues[0].start).toBe(2);
    expect(cues[0].end).toBe(3.2);
  });

  it('consolidates ASR aAppend events into one cue per spoken line', () => {
    // YouTube ASR json3：第一帧带第一个词，后续 aAppend:1 帧累积单词
    const payload = JSON.stringify({
      events: [
        {
          tStartMs: 1000,
          dDurationMs: 4000,
          segs: [{ utf8: 'hello' }],
        },
        {
          tStartMs: 1500,
          aAppend: 1,
          segs: [{ utf8: ' world' }],
        },
        {
          tStartMs: 2000,
          aAppend: 1,
          segs: [{ utf8: ' from fanyi' }],
        },
        {
          tStartMs: 5000,
          dDurationMs: 0,
          segs: [{ utf8: '\n' }],
        },
      ],
    });

    const cues = parseTimedtextPayload(payload);

    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('hello world from fanyi');
    expect(cues[0].start).toBe(1);
  });

  it('dedupes overlapping rolling cues that share a prefix', () => {
    // 模拟 YouTube ASR 滚动字幕：每一帧把前面的内容也带上
    const cues = parseTimedtextPayload(
      [
        '<transcript>',
        '<text start="0" dur="2.0">hello</text>',
        '<text start="0.5" dur="2.5">hello world</text>',
        '<text start="1.0" dur="3.0">hello world this is great</text>',
        '<text start="4.0" dur="2.0">a totally new sentence</text>',
        '</transcript>',
      ].join(''),
    );

    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('hello world this is great');
    expect(cues[1].text).toBe('a totally new sentence');
  });
});
