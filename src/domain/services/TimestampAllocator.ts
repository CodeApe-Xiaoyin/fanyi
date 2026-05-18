import type { BilingualCue, Cue, WordTiming } from '@/domain/models/Cue';
import type { Sentence } from '@/domain/models/Sentence';
import type { TranslationResult } from '@/domain/models/TranslationResult';

function estimateWordTimings(cue: Cue): WordTiming[] {
  const parts = cue.text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return [];
  }

  const totalChars = parts.reduce((sum, word) => sum + word.length + 1, 0);
  let offsetChars = 0;

  return parts.map((word) => {
    const start = cue.start + (offsetChars / totalChars) * (cue.end - cue.start);
    const end =
      cue.start + ((offsetChars + word.length) / totalChars) * (cue.end - cue.start);
    offsetChars += word.length + 1;

    return { word, start, end };
  });
}

export class TimestampAllocator {
  allocate(input: {
    cues: Cue[];
    sentences: Sentence[];
    translations: TranslationResult[];
  }): BilingualCue[] {
    const translationMap = new Map(
      input.translations.map((translation) => [translation.sentenceId, translation.translation]),
    );

    return input.sentences.flatMap((sentence) => {
      const sentenceCues = sentence.cueIndexes.map((index) => input.cues[index]);
      const translation = translationMap.get(sentence.id) ?? sentence.text;

      return sentenceCues.map((cue) => ({
        ...cue,
        sentenceId: sentence.id,
        translation,
        translationSource: 'google' as const,
        wordTimings: estimateWordTimings(cue),
      }));
    });
  }
}
