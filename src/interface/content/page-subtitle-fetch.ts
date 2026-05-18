import type { Cue } from '@/domain/models/Cue';
import type { CaptionTrack } from '@/shared/types';
import {
  buildTimedtextTrackCandidates,
  buildTimedtextUrlVariants,
  parseTimedtextPayload,
} from '@/shared/timedtext';

const REQUEST_EVENT = 'fanyi:page-fetch-request';
const RESPONSE_EVENT = 'fanyi:page-fetch-response';

export async function fetchSubtitlesFromPage(input: {
  captionTrack?: CaptionTrack;
  captionTracks?: CaptionTrack[];
}): Promise<{ cues: Cue[]; sourceLanguage: string }> {
  const tracks = buildTimedtextTrackCandidates(input);
  if (tracks.length === 0) {
    throw new Error('当前视频没有可用的字幕轨。');
  }

  let lastError: string | null = null;

  for (const track of tracks) {
    try {
      const cues = await fetchTrackViaPage(track);
      return {
        cues,
        sourceLanguage: track.languageCode,
      };
    } catch (error) {
      lastError = `${track.languageCode}${track.kind === 'asr' ? ' (auto)' : ''}: ${
        error instanceof Error ? error.message : '字幕抓取失败'
      }`;
    }
  }

  throw new Error(lastError ? `字幕抓取失败：${lastError}` : '字幕抓取失败。');
}

async function fetchTrackViaPage(track: CaptionTrack): Promise<Cue[]> {
  let lastError: string | null = null;

  for (const url of buildTimedtextUrlVariants(track.baseUrl, track)) {
    try {
      const rawText = await directFetchText(url);
      const cues = parseTimedtextPayload(rawText);
      if (cues.length > 0) {
        return cues;
      }
      lastError = '没有解析出有效字幕内容。';
    } catch (error) {
      lastError = error instanceof Error ? error.message : '字幕解析失败。';
      try {
        const rawText = await pageFetchText(url);
        const cues = parseTimedtextPayload(rawText);
        if (cues.length > 0) {
          return cues;
        }
        lastError = '没有解析出有效字幕内容。';
      } catch (bridgeError) {
        lastError =
          bridgeError instanceof Error ? bridgeError.message : lastError ?? '字幕解析失败。';
      }
    }
  }

  throw new Error(lastError ?? '字幕轨尝试失败。');
}

async function directFetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('页面同源字幕请求超时。');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function pageFetchText(url: string): Promise<string> {
  ensurePageBridge();
  const requestId = `fanyi-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('message', onResponse);
      reject(new Error('页面上下文字幕请求超时。'));
    }, 15000);

    const onResponse = (event: MessageEvent): void => {
      if (event.source !== window) {
        return;
      }

      const payload = event.data as
        | {
            type?: string;
            requestId?: string;
            ok?: boolean;
            text?: string;
            error?: string;
          }
        | undefined;

      if (payload?.type !== RESPONSE_EVENT || payload.requestId !== requestId) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener('message', onResponse);

      if (payload.ok) {
        resolve(payload.text ?? '');
      } else {
        reject(new Error(payload.error ?? '页面上下文抓取失败。'));
      }
    };

    window.addEventListener('message', onResponse);
    window.postMessage(
      {
        type: REQUEST_EVENT,
        requestId,
        url,
      },
      '*',
    );
  });
}

function ensurePageBridge(): void {
  if (document.getElementById('fanyi-page-fetch-bridge')) {
    return;
  }

  const script = document.createElement('script');
  script.id = 'fanyi-page-fetch-bridge';
  script.textContent = `
    (() => {
      const requestEvent = '${REQUEST_EVENT}';
      const responseEvent = '${RESPONSE_EVENT}';
      if (window.__fanyiPageFetchBridgeInstalled) return;
      window.__fanyiPageFetchBridgeInstalled = true;
      window.addEventListener('message', async (event) => {
        if (event.source !== window || !event.data || event.data.type !== requestEvent) return;
        const detail = event.data || {};
        try {
          const response = await fetch(detail.url, { credentials: 'include' });
          const text = await response.text();
          window.postMessage({
            type: responseEvent,
            requestId: detail.requestId,
            ok: response.ok,
            text,
            error: response.ok ? undefined : 'HTTP ' + response.status
          }, '*');
        } catch (error) {
          window.postMessage({
            type: responseEvent,
            requestId: detail.requestId,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown page fetch error'
          }, '*');
        }
      });
    })();
  `;
  (document.documentElement || document.head || document.body).append(script);
  script.remove();
}
