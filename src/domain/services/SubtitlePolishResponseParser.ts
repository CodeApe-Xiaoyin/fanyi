import type { TranslationResult } from '@/domain/models/TranslationResult';

type RawTranslationItem =
  | string
  | {
      sentenceId?: unknown;
      id?: unknown;
      translation?: unknown;
      text?: unknown;
    };

export function parseSubtitlePolishResponse(
  input: unknown,
  expectedSentenceIds: string[],
): TranslationResult[] {
  const payload = typeof input === 'string' ? parseJsonFromText(input) : input;
  const translations = extractTranslations(payload);
  if (!Array.isArray(translations)) {
    return [];
  }

  const expected = new Set(expectedSentenceIds);
  const results: TranslationResult[] = [];
  const seen = new Set<string>();

  translations.forEach((item, index) => {
    const parsed = parseTranslationItem(item, expectedSentenceIds[index]);
    if (!parsed) return;
    if (!expected.has(parsed.sentenceId) || seen.has(parsed.sentenceId)) return;

    results.push(parsed);
    seen.add(parsed.sentenceId);
  });

  return results;
}

function parseTranslationItem(
  item: RawTranslationItem,
  fallbackSentenceId: string | undefined,
): TranslationResult | null {
  if (typeof item === 'string') {
    const translation = item.trim();
    return fallbackSentenceId && translation
      ? { sentenceId: fallbackSentenceId, translation }
      : null;
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const sentenceId =
    typeof item.sentenceId === 'string'
      ? item.sentenceId
      : typeof item.id === 'string'
        ? item.id
        : fallbackSentenceId;
  const translation =
    typeof item.translation === 'string'
      ? item.translation.trim()
      : typeof item.text === 'string'
        ? item.text.trim()
        : '';

  return sentenceId && translation ? { sentenceId, translation } : null;
}

function extractTranslations(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = payload as {
    translations?: unknown;
    result?: unknown;
    items?: unknown;
  };

  return candidate.translations ?? candidate.result ?? candidate.items;
}

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const direct = safeParse(trimmed);
  if (direct !== undefined) {
    return direct;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const parsed = safeParse(fenced.trim());
    if (parsed !== undefined) {
      return parsed;
    }
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    return safeParse(trimmed.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return safeParse(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  return undefined;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
