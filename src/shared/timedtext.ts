import type { Cue } from '@/domain/models/Cue';
import type { CaptionTrack } from '@/shared/types';

export function buildTimedtextUrl(baseUrl: string): string {
  const decoded = baseUrl.replace(/\\u0026/g, '&');
  const url = new URL(decoded);
  url.searchParams.set('fmt', 'json3');
  return url.toString();
}

export function buildTimedtextUrlVariants(
  baseUrl: string,
  track?: Pick<CaptionTrack, 'languageCode' | 'kind'>,
): string[] {
  const decoded = baseUrl.replace(/\\u0026/g, '&');
  const original = new URL(decoded);
  const raw = original.toString();
  const rawJson3 = withFmt(original, 'json3');
  const rawSrv3 = withFmt(original, 'srv3');
  const augmentedJson3 = withTrackParams(original, track, (url) =>
    url.searchParams.set('fmt', 'json3'),
  );
  const augmentedSrv3 = withTrackParams(original, track, (url) =>
    url.searchParams.set('fmt', 'srv3'),
  );
  const augmentedWithoutFmt = withTrackParams(original, track, (url) =>
    url.searchParams.delete('fmt'),
  );

  const variants =
    track?.kind === 'asr'
      ? [augmentedJson3, augmentedSrv3, rawJson3, rawSrv3, raw]
      : [augmentedWithoutFmt, augmentedSrv3, augmentedJson3, rawSrv3, raw];

  return [...new Set(variants)];
}

export function buildTimedtextTrackCandidates(input: {
  captionTrack?: CaptionTrack;
  captionTracks?: CaptionTrack[];
}): CaptionTrack[] {
  const ordered = [
    ...(input.captionTrack ? [input.captionTrack] : []),
    ...(input.captionTracks ?? []),
  ];

  const seen = new Set<string>();
  return ordered.filter((track) => {
    const key = `${track.baseUrl}|${track.languageCode}|${track.kind ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function parseTimedtextPayload(rawText: string): Cue[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('字幕接口返回空内容。');
  }

  const json = parseJson3(trimmed);
  if (json.length > 0) {
    return finalizeRollingCues(json);
  }

  const xmlTranscript = parseXmlTranscript(trimmed);
  if (xmlTranscript.length > 0) {
    return finalizeRollingCues(xmlTranscript);
  }

  const srv3 = parseSrv3Transcript(trimmed);
  if (srv3.length > 0) {
    return finalizeRollingCues(srv3);
  }

  throw new Error(`无法识别字幕返回格式：${trimmed.slice(0, 120)}`);
}

/**
 * 合并 ASR 滚动字幕（aAppend / 时间窗重叠的渐增式 cue），
 * 让最终输出是非重叠的完整句子。
 */
function finalizeRollingCues(cues: Cue[]): Cue[] {
  if (cues.length === 0) return cues;
  const sorted = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
  const collapsed: Cue[] = [];

  for (const cue of sorted) {
    const prev = collapsed[collapsed.length - 1];
    const overlapping = prev && cue.start < prev.end + 0.05;

    if (
      prev &&
      overlapping &&
      cue.text.length >= prev.text.length &&
      (cue.text === prev.text ||
        cue.text.startsWith(`${prev.text} `) ||
        cue.text.startsWith(prev.text))
    ) {
      collapsed[collapsed.length - 1] = {
        id: prev.id,
        start: prev.start,
        end: Math.max(prev.end, cue.end),
        text: cue.text,
      };
      continue;
    }

    if (prev && overlapping && prev.text.startsWith(`${cue.text} `)) {
      continue;
    }

    collapsed.push({ ...cue });
  }

  // 钳掉相邻 cue 的尾部，确保非重叠
  for (let i = 0; i < collapsed.length - 1; i += 1) {
    const next = collapsed[i + 1];
    if (collapsed[i].end > next.start) {
      collapsed[i] = { ...collapsed[i], end: next.start };
    }
  }

  return collapsed
    .filter((cue) => cue.end > cue.start && cue.text.length > 0)
    .map((cue, index) => ({ ...cue, id: `cue-${index + 1}` }));
}

function parseJson3(rawText: string): Cue[] {
  let payload: Json3Response | undefined;
  try {
    payload = JSON.parse(rawText) as Json3Response;
  } catch {
    return [];
  }

  // YouTube ASR 的 json3 格式以"窗口流"输出：
  //   - aAppend !== 1 的事件 = 新开一行（带第一段文本）
  //   - aAppend === 1 的事件 = 把后续单词累加到这一行
  // 必须把 aAppend 段累积回去，否则只剩"每行的第一个词"。
  const events = (payload.events ?? []).filter(
    (event): event is RequiredEvent =>
      Array.isArray(event.segs) && event.segs.length > 0,
  );

  const cues: Cue[] = [];
  let current: { start: number; end: number; text: string } | null = null;
  let cueIndex = 0;

  const flush = (): void => {
    if (!current) return;
    const text = normalizeCaptionText(current.text);
    if (text && current.end > current.start) {
      cueIndex += 1;
      cues.push({
        id: `cue-${cueIndex}`,
        start: current.start,
        end: current.end,
        text,
      });
    }
    current = null;
  };

  for (const event of events) {
    const startMs = event.tStartMs ?? 0;
    const durMs = event.dDurationMs ?? 0;
    const segText = event.segs.map((seg) => seg.utf8 ?? '').join('');

    if (event.aAppend === 1 && current) {
      current.text += segText;
      if (durMs > 0) {
        current.end = Math.max(current.end, (startMs + durMs) / 1000);
      }
      continue;
    }

    flush();
    current = {
      start: startMs / 1000,
      end: (startMs + Math.max(durMs, 0)) / 1000,
      text: segText,
    };
  }
  flush();

  return cues;
}

interface RequiredEvent {
  tStartMs?: number;
  dDurationMs?: number;
  aAppend?: number;
  segs: Array<{ utf8?: string }>;
}

function parseXmlTranscript(rawText: string): Cue[] {
  const matches = [...rawText.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];

  return matches
    .map((match, index) => {
      const attrs = match[1] ?? '';
      const body = match[2] ?? '';
      const start = Number(extractAttr(attrs, 'start'));
      const duration = Number(extractAttr(attrs, 'dur'));
      const text = normalizeCaptionText(decodeEntities(stripTags(body)));

      if (!Number.isFinite(start) || !Number.isFinite(duration) || !text) {
        return null;
      }

      return {
        id: `cue-${index + 1}`,
        start,
        end: start + duration,
        text,
      };
    })
    .filter((cue): cue is Cue => cue !== null);
}

function parseSrv3Transcript(rawText: string): Cue[] {
  const matches = [...rawText.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)];

  return matches
    .map((match, index) => {
      const attrs = match[1] ?? '';
      const body = match[2] ?? '';
      const startMs = Number(extractAttr(attrs, 't'));
      const durationMs = Number(extractAttr(attrs, 'd'));
      const text = normalizeCaptionText(decodeEntities(stripTags(body)));

      if (!Number.isFinite(startMs) || !Number.isFinite(durationMs) || !text) {
        return null;
      }

      return {
        id: `cue-${index + 1}`,
        start: startMs / 1000,
        end: (startMs + durationMs) / 1000,
        text,
      };
    })
    .filter((cue): cue is Cue => cue !== null);
}

function extractAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]+)"`));
  return match?.[1];
}

function normalizeCaptionText(input: string): string {
  return input.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, '');
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

interface Json3Response {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    aAppend?: number;
    segs?: Array<{ utf8?: string }>;
  }>;
}

function withFmt(url: URL, fmt: string): string {
  const next = new URL(url.toString());
  next.searchParams.set('fmt', fmt);
  return next.toString();
}

function withTrackParams(
  url: URL,
  track: Pick<CaptionTrack, 'languageCode' | 'kind'> | undefined,
  mutate: (url: URL) => void,
): string {
  const next = new URL(url.toString());
  if (track?.kind === 'asr' && !next.searchParams.has('kind')) {
    next.searchParams.set('kind', 'asr');
  }
  if (track?.languageCode && !next.searchParams.has('lang')) {
    next.searchParams.set('lang', track.languageCode);
  }
  mutate(next);
  return next.toString();
}
