import type { Cue } from '@/domain/models/Cue';
import type { Sentence } from '@/domain/models/Sentence';

const SENTENCE_END = /[.?!。？！]["')\]]*$/;

/**
 * 累计文本长度阈值。超过这个长度强制切句。
 *
 * 之前 180 字符：翻译质量够用但显示效果很差——中文翻译 wrap 到 4-5 行，
 * 垒在画面中央遮挡半个屏幕。80 字符 ≈ 2 个 cue ≈ 1-2 行英文 ≈ 1-2 行中文，
 * 在字幕区域内不会溢出。
 */
const MAX_SENTENCE_CHARS = 80;

/**
 * 句子之间的"沉默"间隔阈值（秒）。说话者有较长停顿就当成新句子起点。
 * 1.2s 比之前的 0.8s 宽松，能把 ASR 里轻微的停顿合并到上一句里，
 * 减少没意义的碎句。
 */
const SILENCE_GAP_SEC = 1.2;

export class SentenceReconstructor {
  inferBoundaries(cues: Cue[]): number[] {
    const boundaries: number[] = [];

    let runningChars = 0;
    let lastBoundary = -1;

    cues.forEach((cue, index) => {
      runningChars += cue.text.length + 1;
      const next = cues[index + 1];

      const endsWithPunctuation = SENTENCE_END.test(cue.text.trim());
      const tooLong = runningChars > MAX_SENTENCE_CHARS;
      const longGap = !next || next.start - cue.end > SILENCE_GAP_SEC;
      const isLast = !next;

      if (endsWithPunctuation || tooLong || longGap || isLast) {
        boundaries.push(index);
        lastBoundary = index;
        runningChars = 0;
      }
    });

    if (lastBoundary !== cues.length - 1 && cues.length > 0) {
      boundaries.push(cues.length - 1);
    }

    return boundaries;
  }

  fromBoundaries(cues: Cue[], boundaries: number[]): Sentence[] {
    const normalized = [...new Set(boundaries)]
      .filter((value) => value >= 0 && value < cues.length)
      .sort((left, right) => left - right);

    const sentences: Sentence[] = [];
    let startIndex = 0;

    normalized.forEach((boundary, boundaryIndex) => {
      const slice = cues.slice(startIndex, boundary + 1);
      if (slice.length === 0) {
        return;
      }

      sentences.push({
        id: `sentence-${boundaryIndex + 1}`,
        text: slice.map((cue) => cue.text).join(' ').replace(/\s+/g, ' ').trim(),
        cueIndexes: slice.map((_, index) => startIndex + index),
        start: slice[0].start,
        end: slice[slice.length - 1].end,
      });
      startIndex = boundary + 1;
    });

    if (startIndex < cues.length) {
      const tail = cues.slice(startIndex);
      sentences.push({
        id: `sentence-${sentences.length + 1}`,
        text: tail.map((cue) => cue.text).join(' ').replace(/\s+/g, ' ').trim(),
        cueIndexes: tail.map((_, index) => startIndex + index),
        start: tail[0].start,
        end: tail[tail.length - 1].end,
      });
    }

    return sentences;
  }
}
