import type { BilingualCue, Cue } from '@/domain/models/Cue';

export function normalizeBilingualCueList(
  value: unknown,
): BilingualCue[] | null {
  if (Array.isArray(value)) {
    const cues = value.filter(isBilingualCue);
    return cues.length > 0 ? cues : null;
  }

  if (value && typeof value === 'object') {
    const entries = Object.values(value);
    if (entries.every((item) => item && typeof item === 'object')) {
      const cues = entries.filter(isBilingualCue);
      return cues.length > 0 ? cues : null;
    }
  }

  return null;
}

function isBilingualCue(value: unknown): value is BilingualCue {
  if (!isCue(value)) {
    return false;
  }

  const candidate = value as Partial<BilingualCue>;
  return (
    typeof candidate.translation === 'string' &&
    typeof candidate.sentenceId === 'string' &&
    Array.isArray(candidate.wordTimings)
  );
}

function isCue(value: unknown): value is Cue {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Cue>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.start === 'number' &&
    Number.isFinite(candidate.start) &&
    typeof candidate.end === 'number' &&
    Number.isFinite(candidate.end) &&
    candidate.end > candidate.start &&
    typeof candidate.text === 'string' &&
    candidate.text.trim().length > 0
  );
}
