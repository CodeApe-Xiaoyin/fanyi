import type {
  AiAskPayload,
  AiAskResponse,
  AiPolishBatchPayload,
  AiPolishBatchResponse,
  AiSummarizePayload,
  AiSummarizeResponse,
  AiTranscribePayload,
  AiTranscribeResponse,
  AnyMessageEnvelope,
  CacheState,
  DebugLogEntry,
  EnsureCaptionsPayload,
  EnsureCaptionsResponse,
  InstallCaptureHookResponse,
  InstantTranslatePayload,
  InstantTranslateResponse,
  LiveTranslatePayload,
  LiveTranslateResponse,
  MessageEnvelope,
  ParseCapturedCaptionPayload,
  ParseCapturedCaptionResponse,
  PipelineResponse,
  ProviderConfig,
  ProviderTestResponse,
  SettingsPatch,
  SourceSubtitlesPayload,
  SourceSubtitlesResponse,
  SubtitleCachePutPayload,
  SubtitleCachePutResponse,
} from '@/shared/types';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  type AppSettings,
} from '@/shared/types';
import {
  appendDebugLog,
  readDebugLogs,
  summarizeUnknown,
  wipeDebugLogs,
} from '@/shared/debug-log';

import type { Container } from '@/composition/container';
import { buildSubtitleCacheKey } from '@/domain/use-cases/SubtitlePipelineUseCase';
import { createProvider } from '@/infrastructure/llm/createProvider';
import { parseSubtitlePolishResponse } from '@/domain/services/SubtitlePolishResponseParser';
import { parseTimedtextPayload } from '@/shared/timedtext';

/** 旧版本默认的高亮色（蓝色）。已存进 chrome.storage 的用户需要被迁移。 */
const LEGACY_HIGHLIGHT_COLOR = '#5BA3FF';

function migrateLegacySettings(settings: AppSettings): AppSettings {
  const storedStyle = ((settings as Partial<AppSettings>).style ??
    {}) as Partial<AppSettings['style']>;
  const legacyScale =
    typeof storedStyle.scalePercent === 'number'
      ? storedStyle.scalePercent
      : DEFAULT_SETTINGS.style.scalePercent;
  const normalized: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    style: {
      ...DEFAULT_SETTINGS.style,
      ...storedStyle,
      zhFontSizePercent:
        typeof storedStyle.zhFontSizePercent === 'number'
          ? storedStyle.zhFontSizePercent
          : legacyScale,
      enFontSizePercent:
        typeof storedStyle.enFontSizePercent === 'number'
          ? storedStyle.enFontSizePercent
          : legacyScale,
      lineOrder: storedStyle.lineOrder === 'en-first' ? 'en-first' : 'zh-first',
    },
    stylePresets: settings.stylePresets ?? DEFAULT_SETTINGS.stylePresets,
    llm: {
      ...DEFAULT_SETTINGS.llm,
      ...settings.llm,
      providers: settings.llm?.providers ?? DEFAULT_SETTINGS.llm.providers,
    },
  };

  // 把存量用户的旧蓝色高亮升级到新版红框样式。
  // 没改过 highlightColor 的用户拿到默认值；自定义过别的颜色的用户保留。
  if (normalized.style?.highlightColor === LEGACY_HIGHLIGHT_COLOR) {
    return {
      ...normalized,
      style: {
        ...normalized.style,
        highlightColor: DEFAULT_SETTINGS.style.highlightColor,
      },
    };
  }
  return normalized;
}

function buildPolishSystemPrompt(input: {
  targetLanguage: string;
  sourceLanguage?: string;
  videoTitle: string;
  channel?: string;
}): string {
  return [
    'You are a senior subtitle localization editor.',
    `Target language: ${input.targetLanguage}.`,
    input.sourceLanguage ? `Source language: ${input.sourceLanguage}.` : '',
    `Video title: ${input.videoTitle}`,
    input.channel ? `Channel: ${input.channel}` : '',
    'You receive source subtitle sentences and draft machine translations.',
    'Rewrite each draft so it sounds natural, concise, and idiomatic to a native viewer while staying faithful to the source.',
    'Keep names, numbers, technical terms, and meaning. Do not add commentary.',
    'Do not merge, split, reorder, or omit items.',
    'Return JSON only in this exact shape: {"translations":[{"sentenceId":"...","translation":"..."}]}',
  ]
    .filter(Boolean)
    .join('\n');
}

function estimatePolishMaxTokens(
  items: Array<{ sourceText: string; draftTranslation: string }>,
): number {
  const chars = items.reduce(
    (sum, item) =>
      sum + item.sourceText.length + item.draftTranslation.length,
    0,
  );
  return Math.min(8000, Math.max(800, Math.ceil(chars * 1.4) + 400));
}

function formatSeconds(seconds: number): string {
  return Number.isFinite(seconds) ? seconds.toFixed(2) : '0.00';
}

export class MessageRouter {
  constructor(private readonly container: Container) {}

  async handle(message: AnyMessageEnvelope, tabId?: number): Promise<unknown> {
    switch (message.type) {
      case 'fanyi/pipeline-run':
        return this.handlePipeline(message.payload);
      case 'fanyi/settings-get':
        return this.getSettings();
      case 'fanyi/settings-update':
        return this.updateSettings(message.payload);
      case 'fanyi/provider-upsert':
        return this.upsertProvider(message.payload);
      case 'fanyi/provider-delete':
        return this.deleteProvider(message.payload.providerId);
      case 'fanyi/provider-activate':
        return this.activateProvider(message.payload.providerId);
      case 'fanyi/provider-test':
        return this.testProvider(message.payload);
      case 'fanyi/source-subtitles-fetch':
        return this.fetchSourceSubtitles(message.payload, tabId);
      case 'fanyi/live-translate':
        return this.liveTranslate(message.payload);
      case 'fanyi/instant-translate':
        return this.instantTranslate(message.payload);
      case 'fanyi/ai-polish-batch':
        return this.aiPolishBatch(message.payload);
      case 'fanyi/subtitle-cache-put':
        return this.putSubtitleCache(message.payload);
      case 'fanyi/ensure-captions':
        return this.ensureCaptions(message.payload, tabId);
      case 'fanyi/install-capture-hook':
        return this.installCaptureHook(tabId);
      case 'fanyi/parse-captured-caption':
        return this.parseCapturedCaption(message.payload);
      case 'fanyi/debug-logs-get':
        return this.getDebugLogs();
      case 'fanyi/debug-logs-clear':
        return this.clearDebugLogs();
      case 'fanyi/cache-get':
        return this.getCacheState();
      case 'fanyi/cache-clear':
        return this.clearCache();
      case 'fanyi/style-update':
        return this.updateStyle(message.payload);
      case 'fanyi/enabled-update':
        return this.updateSettings(message.payload);
      case 'fanyi/ai-summarize':
        return this.handleAiSummarize(message.payload);
      case 'fanyi/ai-ask':
        return this.handleAiAsk(message.payload);
      case 'fanyi/ai-transcribe':
        return this.handleAiTranscribe(message.payload);
      default:
        return { ok: false, error: 'Unsupported message.' };
    }
  }

  private async handlePipeline(
    payload: MessageEnvelope<'fanyi/pipeline-run'>['payload'],
  ): Promise<PipelineResponse> {
    const settings = await this.getSettings();
    if (!settings.enabled) {
      return { ok: false, error: 'Fanyi 当前已禁用。' };
    }

    try {
      await appendDebugLog({
        level: 'info',
        source: 'background',
        event: 'pipeline.start',
        details: summarizeUnknown({
          videoId: payload.video.videoId,
          sourceSubtitleCount: payload.sourceSubtitles?.cues?.length ?? 0,
          sourceLanguage:
            payload.sourceSubtitles?.sourceLanguage ??
            payload.video.sourceLanguage,
        }),
      });
      const cues = await this.container.pipeline.runWithSource(
        payload.video,
        settings,
        payload.sourceSubtitles,
      );
      await appendDebugLog({
        level: 'info',
        source: 'background',
        event: 'pipeline.success',
        details: summarizeUnknown({
          cueCount: Array.isArray(cues) ? cues.length : 'not-array',
          firstCue: Array.isArray(cues) ? cues[0] : cues,
        }),
      });
      return {
        ok: true,
        data: {
          cues,
          style: settings.style,
          sourceLanguage:
            payload.sourceSubtitles?.sourceLanguage ??
            payload.video.captionTrack?.languageCode ??
            'en',
          targetLanguage: settings.targetLanguage,
        },
      };
    } catch (error) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'pipeline.error',
        details: summarizeUnknown(error),
      });
      return {
        ok: false,
        error: error instanceof Error ? error.message : '字幕处理失败。',
      };
    }
  }

  private async getSettings(): Promise<AppSettings> {
    const stored = await this.container.storage.get(
      STORAGE_KEYS.settings,
      DEFAULT_SETTINGS,
    );
    return migrateLegacySettings(stored);
  }

  private async updateSettings(patch: SettingsPatch): Promise<AppSettings> {
    const settings = await this.getSettings();
    const next: AppSettings = {
      ...settings,
      ...patch,
      llm: {
        ...settings.llm,
        ...patch.llm,
      },
      style: {
        ...settings.style,
        ...patch.style,
      },
    };

    await this.container.storage.set(STORAGE_KEYS.settings, next);
    return next;
  }

  private async updateStyle(
    patch: Partial<AppSettings['style']>,
  ): Promise<AppSettings> {
    return this.updateSettings({ style: patch });
  }

  private async upsertProvider(provider: ProviderConfig): Promise<AppSettings> {
    const settings = await this.getSettings();
    const existingIndex = settings.llm.providers.findIndex(
      (item) => item.id === provider.id,
    );
    const providers =
      existingIndex >= 0
        ? settings.llm.providers.map((item, index) =>
            index === existingIndex ? provider : item,
          )
        : [...settings.llm.providers, provider];

    return this.updateSettings({
      llm: {
        ...settings.llm,
        providers,
        activeProviderId: settings.llm.activeProviderId || provider.id,
      },
    });
  }

  private async deleteProvider(providerId: string): Promise<AppSettings> {
    const settings = await this.getSettings();
    const providers = settings.llm.providers.filter(
      (item) => item.id !== providerId,
    );

    return this.updateSettings({
      llm: {
        ...settings.llm,
        providers,
        activeProviderId:
          settings.llm.activeProviderId === providerId
            ? (providers[0]?.id ?? '')
            : settings.llm.activeProviderId,
      },
    });
  }

  private async activateProvider(providerId: string): Promise<AppSettings> {
    const settings = await this.getSettings();

    return this.updateSettings({
      llm: {
        ...settings.llm,
        activeProviderId: providerId,
      },
    });
  }

  private async testProvider(
    provider: ProviderConfig,
  ): Promise<ProviderTestResponse> {
    try {
      const client = createProvider(provider);
      const response = await client.chat({
        model: 'model' in provider ? provider.model : provider.name,
        system:
          'You are validating a provider connection for a browser extension setup.',
        messages: [
          {
            role: 'user',
            content:
              'Reply with a very short plain-text confirmation like "ok" or "connected".',
          },
        ],
        temperature: 0,
        maxTokens: 24,
      });

      return {
        ok: true,
        providerId: provider.id,
        providerType: provider.type,
        responsePreview: response.text.slice(0, 120) || 'Empty response',
      };
    } catch (error) {
      return {
        ok: false,
        providerId: provider.id,
        providerType: provider.type,
        error: error instanceof Error ? error.message : 'Provider test failed.',
      };
    }
  }

  private async getCacheState(): Promise<CacheState> {
    const [count, entries] = await Promise.all([
      this.container.cache.count(),
      this.container.cache.list(8),
    ]);

    return {
      count,
      entries,
    };
  }

  private async clearCache(): Promise<CacheState> {
    await this.container.cache.clear();
    return this.getCacheState();
  }

  private async getDebugLogs(): Promise<DebugLogEntry[]> {
    return await readDebugLogs();
  }

  private async clearDebugLogs(): Promise<{ ok: true }> {
    await wipeDebugLogs();
    return { ok: true };
  }

  private async liveTranslate(
    payload: LiveTranslatePayload,
  ): Promise<LiveTranslateResponse | { ok: false; error: string }> {
    try {
      const settings = await this.getSettings();
      const provider = settings.llm.providers.find(
        (item) => item.id === settings.llm.activeProviderId,
      );

      if (!provider) {
        throw new Error('请先在 Providers 页配置并激活一个 provider。');
      }

      const client = createProvider(provider);
      const model = 'model' in provider ? provider.model : provider.name;

      // 有草稿（MT）时把 LLM 当成"润色器"——成本/延迟低很多；
      // 没草稿时退化成"译者"。
      const isPolishMode = Boolean(payload.draftTranslation?.trim());
      const system = isPolishMode
        ? [
            'You are a subtitle polish editor.',
            `Target language: ${settings.targetLanguage}.`,
            'You are given the source subtitle line and a draft machine translation.',
            'Rewrite the draft so it reads naturally to a native speaker, fixing literal MT phrasing while staying faithful to the source.',
            'Keep proper nouns. Do not add or remove information.',
            'Return only the polished translation, with no explanation, no quotation marks.',
          ].join('\n')
        : [
            'You are a professional subtitle translator.',
            `Target language: ${settings.targetLanguage}.`,
            'Translate the subtitle line naturally and concisely.',
            'Return only the translated line, with no explanation, no quotation marks.',
          ].join('\n');

      const userContent = [
        `Title: ${payload.video.title}`,
        payload.video.channel ? `Channel: ${payload.video.channel}` : '',
        `Source: ${payload.cueText}`,
        isPolishMode ? `Draft translation: ${payload.draftTranslation}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await client.chat({
        model,
        system,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.2,
        maxTokens: 200,
      });

      await appendDebugLog({
        level: 'info',
        source: 'background',
        event: 'live-translate.success',
        details: summarizeUnknown({
          source: payload.cueText,
          translation: response.text,
        }),
      });

      return {
        ok: true,
        translation: response.text.trim(),
      };
    } catch (error) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'live-translate.error',
        details: summarizeUnknown(error),
      });
      return {
        ok: false,
        error: error instanceof Error ? error.message : '实时翻译失败。',
      };
    }
  }

  private async instantTranslate(
    payload: InstantTranslatePayload,
  ): Promise<InstantTranslateResponse> {
    try {
      const settings = await this.getSettings();
      const text = payload.text.trim();
      if (!text) {
        return { ok: true, translation: '' };
      }

      const translation = await this.container.instantTranslator.translate({
        text,
        sourceLanguage: payload.sourceLanguage,
        targetLanguage: settings.targetLanguage,
      });

      return { ok: true, translation };
    } catch (error) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'instant-translate.error',
        details: summarizeUnknown(error),
      });
      return {
        ok: false,
        error: error instanceof Error ? error.message : '即时翻译失败。',
      };
    }
  }

  private async aiPolishBatch(
    payload: AiPolishBatchPayload,
  ): Promise<AiPolishBatchResponse> {
    try {
      const settings = await this.getSettings();
      const provider = settings.llm.providers.find(
        (item) => item.id === settings.llm.activeProviderId,
      );

      if (!provider) {
        throw new Error('请先在 Providers 页配置并激活一个 provider。');
      }

      const items = payload.items
        .filter(
          (item) =>
            item.sentenceId &&
            item.sourceText.trim() &&
            item.draftTranslation.trim(),
        )
        .slice(0, 40);

      if (items.length === 0) {
        return { ok: true, translations: [] };
      }

      const client = createProvider(provider);
      const model = 'model' in provider ? provider.model : provider.name;
      const response = await client.chat({
        model,
        system: buildPolishSystemPrompt({
          targetLanguage: settings.targetLanguage,
          sourceLanguage: payload.sourceLanguage,
          videoTitle: payload.video.title,
          channel: payload.video.channel,
        }),
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              instructions:
                'Polish every draftTranslation. Keep sentenceId exactly. Return JSON only.',
              items: items.map((item) => ({
                sentenceId: item.sentenceId,
                time: `${formatSeconds(item.start)}-${formatSeconds(item.end)}`,
                sourceText: item.sourceText,
                draftTranslation: item.draftTranslation,
              })),
            }),
          },
        ],
        temperature: 0.2,
        maxTokens: estimatePolishMaxTokens(items),
        jsonSchema: {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sentenceId: { type: 'string' },
                  translation: { type: 'string' },
                },
                required: ['sentenceId', 'translation'],
              },
            },
          },
          required: ['translations'],
        },
      });

      const translations = parseSubtitlePolishResponse(
        response.json ?? response.text,
        items.map((item) => item.sentenceId),
      );

      if (translations.length === 0) {
        throw new Error('AI 润色返回为空或不是合法 JSON。');
      }

      await appendDebugLog({
        level: 'info',
        source: 'background',
        event: 'ai-polish.batch-success',
        details: summarizeUnknown({
          videoId: payload.video.videoId,
          requested: items.length,
          polished: translations.length,
        }),
      });

      return { ok: true, translations };
    } catch (error) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'ai-polish.batch-error',
        details: summarizeUnknown(error),
      });

      return {
        ok: false,
        error: error instanceof Error ? error.message : 'AI 润色失败。',
      };
    }
  }

  private async putSubtitleCache(
    payload: SubtitleCachePutPayload,
  ): Promise<SubtitleCachePutResponse> {
    try {
      const settings = await this.getSettings();
      const cacheKey = buildSubtitleCacheKey(payload.video, settings);
      await this.container.cache.put(cacheKey, payload.cues);

      await appendDebugLog({
        level: 'info',
        source: 'background',
        event: 'subtitle-cache.put',
        details: summarizeUnknown({
          videoId: payload.video.videoId,
          cueCount: payload.cues.length,
          cacheKey,
        }),
      });

      return { ok: true };
    } catch (error) {
      await appendDebugLog({
        level: 'warn',
        source: 'background',
        event: 'subtitle-cache.put-error',
        details: summarizeUnknown(error),
      });
      return {
        ok: false,
        error: error instanceof Error ? error.message : '写入字幕缓存失败。',
      };
    }
  }

  /**
   * 在 MAIN world 里给 window.fetch / XMLHttpRequest 装上钩子，
   * YouTube 自己 fetch 字幕轨时我们就能截获到。
   *
   * 这是绕开"我们直接 fetch timedtext 拿到 200 + 空响应"问题的办法 ——
   * YouTube 的播放器内部 fetch 是带正确签名/cookie/UA 的，能拿到真数据。
   * 我们就拦它的响应，原样转给后台 pipeline。
   */
  private async installCaptureHook(
    tabId?: number,
  ): Promise<InstallCaptureHookResponse> {
    if (!tabId) {
      return { ok: false, error: '无法获取当前标签页。' };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const win = window as unknown as {
            __fanyiCaptureInstalled?: boolean;
            __fanyiCapturedCaptions?: Array<{
              url: string;
              text: string;
              capturedAt: number;
            }>;
            __fanyiFlushCapturedCaptions?: () => void;
          };
          if (win.__fanyiCaptureInstalled) {
            win.__fanyiFlushCapturedCaptions?.();
            return { alreadyInstalled: true };
          }
          win.__fanyiCaptureInstalled = true;

          const TIMEDTEXT_MARK = '/api/timedtext';

          const postCapture = (capture: {
            url: string;
            text: string;
            capturedAt: number;
          }): void => {
            try {
              window.postMessage(
                {
                  __fanyi: 'caption-captured',
                  ...capture,
                },
                '*',
              );
            } catch (err) {
              // postMessage 极少会失败，失败也只是丢一帧，不闹大
              console.warn('[Fanyi] caption postMessage failed', err);
            }
          };

          const notify = (url: string, text: string): void => {
            if (!text.trim()) return;

            const capture = {
              url,
              text,
              capturedAt: Date.now(),
            };
            win.__fanyiCapturedCaptions ??= [];
            win.__fanyiCapturedCaptions.push(capture);
            while (win.__fanyiCapturedCaptions.length > 12) {
              win.__fanyiCapturedCaptions.shift();
            }
            postCapture(capture);
          };

          win.__fanyiFlushCapturedCaptions = () => {
            for (const capture of win.__fanyiCapturedCaptions ?? []) {
              postCapture(capture);
            }
          };

          const readXhrResponseText = async (
            xhr: XMLHttpRequest,
          ): Promise<string> => {
            try {
              if (
                (xhr.responseType === '' || xhr.responseType === 'text') &&
                typeof xhr.responseText === 'string'
              ) {
                return xhr.responseText;
              }
            } catch {
              // responseText throws for json/blob/arraybuffer response types.
            }

            const response = xhr.response;
            if (typeof response === 'string') {
              return response;
            }
            if (response instanceof Document) {
              return new XMLSerializer().serializeToString(response);
            }
            if (response instanceof Blob) {
              return await response.text();
            }
            if (response instanceof ArrayBuffer) {
              return new TextDecoder().decode(response);
            }
            if (response && typeof response === 'object') {
              return JSON.stringify(response);
            }
            return '';
          };

          // ---- Patch fetch ----
          const originalFetch = window.fetch.bind(window);
          window.fetch = async function patchedFetch(
            ...args: Parameters<typeof originalFetch>
          ) {
            const response = await originalFetch(...args);
            try {
              const input = args[0];
              const url =
                input instanceof Request ? input.url : String(input ?? '');
              if (url.includes(TIMEDTEXT_MARK) && response.ok) {
                response
                  .clone()
                  .text()
                  .then((text) => {
                    if (text && text.trim().length > 0) {
                      notify(url, text);
                    }
                  })
                  .catch(() => {
                    /* ignore clone failures */
                  });
              }
            } catch {
              /* never let our wrapper break the page */
            }
            return response;
          };

          // ---- Patch XMLHttpRequest（保险起见，YouTube 老路径偶尔走这个） ----
          const xhrProto = XMLHttpRequest.prototype as unknown as {
            open: XMLHttpRequest['open'];
            send: XMLHttpRequest['send'];
          };
          const origOpen = xhrProto.open;
          const origSend = xhrProto.send;

          xhrProto.open = function (
            this: XMLHttpRequest & { __fanyiUrl?: string },
            method: string,
            url: string | URL,
            ...rest: unknown[]
          ) {
            this.__fanyiUrl = String(url);
            return origOpen.apply(this, [method, url, ...rest] as Parameters<
              XMLHttpRequest['open']
            >);
          } as XMLHttpRequest['open'];

          xhrProto.send = function (
            this: XMLHttpRequest & { __fanyiUrl?: string },
            ...args: Parameters<XMLHttpRequest['send']>
          ) {
            if (this.__fanyiUrl?.includes(TIMEDTEXT_MARK)) {
              this.addEventListener('load', () => {
                void readXhrResponseText(this)
                  .then((text) => {
                    if (this.status >= 200 && this.status < 300 && text.trim()) {
                      notify(this.__fanyiUrl ?? '', text);
                    }
                  })
                  .catch(() => {
                    /* swallow */
                  });
              });
            }
            return origSend.apply(this, args);
          } as XMLHttpRequest['send'];

          return { alreadyInstalled: false };
        },
      });

      const data = result[0]?.result as
        | { alreadyInstalled: boolean }
        | undefined;

      await appendDebugLog({
        level: 'info',
        source: 'background',
        event: 'install-capture-hook.result',
        details: summarizeUnknown(data),
      });

      return { ok: true, alreadyInstalled: data?.alreadyInstalled ?? false };
    } catch (error) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'install-capture-hook.error',
        details: summarizeUnknown(error),
      });
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : '安装字幕抓取钩子失败。',
      };
    }
  }

  private async parseCapturedCaption(
    payload: ParseCapturedCaptionPayload,
  ): Promise<ParseCapturedCaptionResponse> {
    try {
      const cues = parseTimedtextPayload(payload.text);
      if (cues.length === 0) {
        return { ok: false, error: '截获的字幕内容为空。' };
      }

      const langFromUrl = (() => {
        try {
          return new URL(payload.url).searchParams.get('lang') ?? undefined;
        } catch {
          return undefined;
        }
      })();

      const sourceLanguage = payload.languageCode || langFromUrl || 'en';

      await appendDebugLog({
        level: 'info',
        source: 'background',
        event: 'parse-captured-caption.success',
        details: summarizeUnknown({
          url: payload.url,
          sourceLanguage,
          cueCount: cues.length,
          firstCue: cues[0],
        }),
      });

      return { ok: true, cues, sourceLanguage };
    } catch (error) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'parse-captured-caption.error',
        details: summarizeUnknown(error),
      });
      return {
        ok: false,
        error: error instanceof Error ? error.message : '解析截获字幕失败。',
      };
    }
  }

  /**
   * 在页面 main world 里调用 YouTube 自己的 player API 把字幕开关打开，
   * 并尽量挑选用户偏好的字幕轨（手动 > ASR）。MV3 隔离世界拿不到 movie_player
   * 的方法，必须借 chrome.scripting 跨过去。
   */
  private async ensureCaptions(
    payload: EnsureCaptionsPayload,
    tabId?: number,
  ): Promise<EnsureCaptionsResponse> {
    if (!tabId) {
      return { ok: false, error: '无法获取当前标签页。' };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (prefs: {
          preferredLanguage: string;
          allowAutoGenerated: boolean;
          forceReload?: boolean;
        }) => {
          const player = document.getElementById('movie_player') as unknown as {
            loadModule?: (name: string) => void;
            getOption?: (
              module: string,
              name: string,
              args?: unknown,
            ) => unknown;
            setOption?: (module: string, name: string, value: unknown) => void;
            toggleSubtitlesOn?: () => void;
            isSubtitlesOn?: () => boolean;
          } | null;

          if (!player || !player.loadModule || !player.getOption) {
            return { opened: false, selectedTrackName: undefined };
          }

          // 加载 captions 模块（已加载就是 no-op）
          try {
            player.loadModule('captions');
          } catch {
            /* ignore */
          }

          // 拉到当前可用的字幕轨（含 ASR）
          const tracksRaw = player.getOption('captions', 'tracklist', {
            includeAsr: true,
          });
          const tracks = Array.isArray(tracksRaw)
            ? (tracksRaw as Array<{
                languageCode?: string;
                kind?: string;
                displayName?: string;
                name?: { simpleText?: string } | string;
              }>)
            : [];

          if (tracks.length === 0) {
            return { opened: false, selectedTrackName: undefined };
          }

          const baseLang = (code: string | undefined): string =>
            (code ?? '').toLowerCase().split(/[-_]/)[0] ?? '';

          const preferredBase = baseLang(prefs.preferredLanguage);
          const score = (track: {
            languageCode?: string;
            kind?: string;
          }): number => {
            let s = 0;
            if (track.languageCode === prefs.preferredLanguage) s += 1000;
            if (baseLang(track.languageCode) === preferredBase) s += 500;
            if (track.kind !== 'asr') s += 200;
            return s;
          };

          const usable = prefs.allowAutoGenerated
            ? tracks
            : tracks.filter((track) => track.kind !== 'asr');
          const sorted = [...usable].sort((a, b) => score(b) - score(a));
          const target = sorted[0];

          if (!target) {
            return { opened: false, selectedTrackName: undefined };
          }

          const readCaptionButtonPressed = (): boolean | undefined => {
            const button = document.querySelector(
              '.ytp-subtitles-button',
            ) as HTMLElement | null;
            const pressed = button?.getAttribute('aria-pressed');
            return pressed === null || pressed === undefined
              ? undefined
              : pressed === 'true';
          };

          const clickCaptionButton = (): boolean => {
            const button = document.querySelector(
              '.ytp-subtitles-button',
            ) as HTMLElement | null;
            if (!button) return false;
            button.click();
            return true;
          };

          let setTrackSucceeded = false;
          try {
            player.setOption?.('captions', 'track', target);
            setTrackSucceeded = true;
          } catch {
            setTrackSucceeded = false;
          }

          // toggleSubtitlesOn is a real toggle on some YouTube builds. Calling it
          // unconditionally after setOption can turn an already-open caption track
          // off, which then prevents the player from issuing a fresh timedtext
          // request. Only use it when we know captions are still off, or when
          // setOption itself failed and this is our only fallback.
          const subtitlesOn =
            typeof player.isSubtitlesOn === 'function'
              ? player.isSubtitlesOn()
              : setTrackSucceeded;
          const domButtonPressedBefore = readCaptionButtonPressed();
          let usedButtonClick = false;

          if (prefs.forceReload && (subtitlesOn || domButtonPressedBefore)) {
            usedButtonClick = clickCaptionButton() || usedButtonClick;
            setTimeout(() => {
              player.setOption?.('captions', 'track', target);
              clickCaptionButton();
            }, 120);
          } else if (!subtitlesOn || domButtonPressedBefore === false) {
            try {
              player.toggleSubtitlesOn?.();
            } catch {
              /* ignore */
            }
            if (readCaptionButtonPressed() === false) {
              usedButtonClick = clickCaptionButton() || usedButtonClick;
            }
          }

          const trackName =
            typeof target.name === 'string'
              ? target.name
              : (target.name?.simpleText ??
                target.displayName ??
                target.languageCode);

          return {
            opened: true,
            selectedTrackName: trackName,
            domButtonPressed: readCaptionButtonPressed(),
            usedButtonClick,
          };
        },
        args: [payload],
      });

      const data = result[0]?.result as
        | {
            opened: boolean;
            selectedTrackName?: string;
            domButtonPressed?: boolean;
            usedButtonClick?: boolean;
          }
        | undefined;

      await appendDebugLog({
        level: 'info',
        source: 'background',
        event: 'ensure-captions.result',
        details: summarizeUnknown(data),
      });

      return {
        ok: true,
        opened: data?.opened ?? false,
        selectedTrackName: data?.selectedTrackName,
        domButtonPressed: data?.domButtonPressed,
        usedButtonClick: data?.usedButtonClick,
      };
    } catch (error) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'ensure-captions.error',
        details: summarizeUnknown(error),
      });
      return {
        ok: false,
        error: error instanceof Error ? error.message : '开启原生字幕失败。',
      };
    }
  }

  private async fetchSourceSubtitles(
    payload: SourceSubtitlesPayload,
    tabId?: number,
  ): Promise<SourceSubtitlesResponse> {
    if (!tabId) {
      throw new Error('无法确定当前标签页，不能在页面上下文抓取字幕。');
    }

    const resultNodeId = `fanyi-subtitles-result-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const settings = await this.getSettings();
    const trackPreferences = {
      preferredLanguage: settings.preferredCaptionLanguage,
      allowAutoGenerated: settings.allowAutoGeneratedCaptions,
    };

    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (
        input: SourceSubtitlesPayload,
        nodeId: string,
        prefs: { preferredLanguage: string; allowAutoGenerated: boolean },
      ) => {
        type RawTrack = {
          baseUrl: string;
          languageCode: string;
          kind?: string;
          name?:
            | string
              | { simpleText?: string; runs?: Array<{ text?: string }> };
          vssId?: string;
          source?: 'content' | 'player-response' | 'player-option' | 'performance';
        };

        const readTracksFromPage = (): RawTrack[] => {
          // ytInitialPlayerResponse is the canonical source on YouTube and is always
          // up-to-date (including after SPA navigation), unlike inline <script> tags
          // which the content script reads with a brittle regex.
          const player = document.getElementById('movie_player') as unknown as {
            getPlayerResponse?: () => unknown;
            getOption?: (
              module: string,
              name: string,
              args?: unknown,
            ) => unknown;
          } | null;
          const responseCandidates: unknown[] = [
            (window as unknown as { ytInitialPlayerResponse?: unknown })
              .ytInitialPlayerResponse,
            player?.getPlayerResponse?.(),
          ];

          const isUsableTrack = (track: unknown): track is RawTrack =>
            Boolean(
              track &&
                typeof track === 'object' &&
                typeof (track as RawTrack).baseUrl === 'string' &&
                (track as RawTrack).baseUrl.length > 0 &&
                typeof (track as RawTrack).languageCode === 'string' &&
                (track as RawTrack).languageCode.length > 0,
            );

          const extractTracksFromPlayerResponse = (
            candidate: unknown,
          ): RawTrack[] => {
            const tracks = (
              candidate as
                | {
                    captions?: {
                      playerCaptionsTracklistRenderer?: {
                        captionTracks?: RawTrack[];
                      };
                    };
                  }
                | undefined
            )?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            return Array.isArray(tracks)
              ? tracks.filter(isUsableTrack).map((track) => ({
                  ...track,
                  source: 'player-response',
                }))
              : [];
          };

          const extractTracksFromOption = (value: unknown): RawTrack[] => {
            const tracks = Array.isArray(value)
              ? value
              : (
                  value as
                    | {
                        captionTracks?: unknown[];
                        tracks?: unknown[];
                      }
                    | undefined
                )?.captionTracks ??
                (
                  value as
                    | {
                        captionTracks?: unknown[];
                        tracks?: unknown[];
                      }
                    | undefined
                )?.tracks ??
                [];

            return Array.isArray(tracks)
              ? tracks.filter(isUsableTrack).map((track) => ({
                  ...track,
                  source: 'player-option',
                }))
              : [];
          };

          const tracksFromResponse = responseCandidates.flatMap(
            extractTracksFromPlayerResponse,
          );
          const tracksFromPlayerOptions = [
            player?.getOption?.('captions', 'tracklist', { includeAsr: true }),
            player?.getOption?.('captions', 'tracklist'),
          ].flatMap(extractTracksFromOption);

          if (tracksFromResponse.length > 0 || tracksFromPlayerOptions.length > 0) {
            // Prefer canonical player responses. The player option tracklist can be
            // incomplete on some YouTube builds, so it is only an extra source.
            return [...tracksFromResponse, ...tracksFromPlayerOptions];
          }

          return [];
        };

        const readTimedtextTracksFromPerformance = (
          videoId: string | undefined,
        ): RawTrack[] => {
          const entries =
            typeof performance?.getEntriesByType === 'function'
              ? performance.getEntriesByType('resource')
              : [];
          const tracks: RawTrack[] = [];

          for (const entry of entries) {
            const url = (entry as PerformanceResourceTiming).name;
            if (typeof url !== 'string' || !url.includes('/api/timedtext')) {
              continue;
            }

            try {
              const parsed = new URL(url);
              const entryVideoId = parsed.searchParams.get('v');
              if (videoId && entryVideoId && entryVideoId !== videoId) {
                continue;
              }

              const languageCode = parsed.searchParams.get('lang') ?? '';
              if (!languageCode) {
                continue;
              }

              tracks.push({
                baseUrl: url,
                languageCode,
                kind: parsed.searchParams.get('kind') ?? undefined,
                name: `${languageCode} (player request)`,
                source: 'performance',
              });
            } catch {
              // Ignore malformed resource URLs.
            }
          }

          // Most recent player-generated URL first; it is the most likely one to
          // include current proof-of-origin token parameters such as pot/potc.
          return tracks.reverse();
        };

        const trackName = (track: RawTrack): string => {
          if (typeof track.name === 'string') return track.name;
          if (track.name && typeof track.name === 'object') {
            return (
              track.name.simpleText ??
              track.name.runs?.map((item) => item.text ?? '').join('') ??
              track.languageCode
            );
          }
          return track.languageCode || 'unknown';
        };

        const baseLang = (code: string | undefined): string => {
          const normalized = (code ?? '').toLowerCase();
          return normalized.split(/[-_]/)[0] ?? normalized;
        };

        const scoreTrack = (track: RawTrack): number => {
          const trackBase = baseLang(track.languageCode);
          const exact =
            track.languageCode === prefs.preferredLanguage ? 1000 : 0;
          const base =
            trackBase === baseLang(prefs.preferredLanguage) ? 500 : 0;
          const manual = track.kind === 'asr' ? 0 : 200;
          const human = /auto|automatic|generated/i.test(trackName(track))
            ? 0
            : 40;
          const shortLang = track.languageCode.length <= 5 ? 10 : 0;
          return exact + base + manual + human + shortLang;
        };

        const buildTrackCandidates = (value: {
          videoId?: string;
          captionTrack?: RawTrack;
          captionTracks?: RawTrack[];
        }): RawTrack[] => {
          const fromPerformance = readTimedtextTracksFromPerformance(value.videoId);
          const fromContent: RawTrack[] = [
            ...(value.captionTrack
              ? [{ ...value.captionTrack, source: 'content' as const }]
              : []),
            ...(value.captionTracks ?? []).map((track) => ({
              ...track,
              source: 'content' as const,
            })),
          ];
          const fromPage = readTracksFromPage();

          // Merge tracks from player-generated requests, content script, and
          // canonical player response. The performance entries matter for newer
          // YouTube ASR tracks because they include pot/potc proof parameters.
          const merged = [...fromPerformance, ...fromContent, ...fromPage];
          const seen = new Set<string>();
          const unique = merged.filter((track) => {
            if (
              !track ||
              typeof track.baseUrl !== 'string' ||
              !track.baseUrl ||
              typeof track.languageCode !== 'string' ||
              !track.languageCode
            )
              return false;
            const key = `${track.baseUrl}|${track.languageCode}|${track.kind ?? ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          const filtered = prefs.allowAutoGenerated
            ? unique
            : unique.filter((track) => track.kind !== 'asr');

          const fromPlayerRequest = filtered
            .filter((track) => track.source === 'performance')
            .sort((left, right) => scoreTrack(right) - scoreTrack(left));
          if (fromPlayerRequest.length > 0) {
            const playerRequestKeys = new Set(
              fromPlayerRequest.map(
                (track) =>
                  `${track.baseUrl}|${track.languageCode}|${track.kind ?? ''}`,
              ),
            );
            const rest = filtered
              .filter(
                (track) =>
                  !playerRequestKeys.has(
                    `${track.baseUrl}|${track.languageCode}|${track.kind ?? ''}`,
                  ),
              )
              .sort((left, right) => scoreTrack(right) - scoreTrack(left));
            return [...fromPlayerRequest, ...rest];
          }

          // Stable preference-aware sort: track passed in by content script (already
          // user-selected) keeps precedence at the top, the rest sorted by score.
          const explicit = value.captionTrack ? [value.captionTrack] : [];
          const explicitKeys = new Set(
            explicit.map(
              (track) =>
                `${track.baseUrl}|${track.languageCode}|${track.kind ?? ''}`,
            ),
          );

          const remaining = filtered
            .filter(
              (track) =>
                !explicitKeys.has(
                  `${track.baseUrl}|${track.languageCode}|${track.kind ?? ''}`,
                ),
            )
            .sort((left, right) => scoreTrack(right) - scoreTrack(left));

          return [...explicit, ...remaining];
        };

        const buildUrlVariants = (track: RawTrack) => {
          const decoded = String(track.baseUrl).replace(/\\u0026/g, '&');
          const base = new URL(decoded);

          // YouTube 自动生成字幕 (kind: 'asr') 的 baseUrl 通常只埋了
          // caps=asr 这个能力声明，没有 kind=asr 也没有 lang。YouTube 自己
          // 的 player 在 fetch 之前会动态把 kind / lang / fmt 拼上去；我们
          // 直接用 baseUrl 拉的话会拿到空响应。
          //
          // 这里的策略：把 track.kind / track.languageCode 显式写回 URL，
          // 然后试多种 fmt 组合。
          const augment = (mutate: (url: URL) => void): string => {
            const next = new URL(base.toString());
            if (track.kind === 'asr' && !next.searchParams.has('kind')) {
              next.searchParams.set('kind', 'asr');
            }
            if (track.languageCode && !next.searchParams.has('lang')) {
              next.searchParams.set('lang', track.languageCode);
            }
            mutate(next);
            return next.toString();
          };

          const withFmt = (fmt: string) =>
            augment((url) => url.searchParams.set('fmt', fmt));
          const withoutFmt = () =>
            augment((url) => url.searchParams.delete('fmt'));
          // 完全不动 URL 的兜底：万一我们补的 kind / lang 把 sparams 签名
          // 给搞糊涂了，YouTube 自己不在 sparams 里的参数其实可以加，但为了
          // 不冒险，这里给一个原封不动的版本，外加 fmt=json3 单独一个的版本。
          const rawWithFmt = (fmt: string): string => {
            const next = new URL(base.toString());
            next.searchParams.set('fmt', fmt);
            return next.toString();
          };
          const raw = (): string => base.toString();

          if (track.kind === 'asr') {
            // ASR：YouTube 对 "无 fmt" 通常返回空，必须给 fmt。
            // 顺序：augmented json3 → augmented srv3 → 原始+json3 → 原始。
            return [
              withFmt('json3'),
              withFmt('srv3'),
              rawWithFmt('json3'),
              rawWithFmt('srv3'),
              raw(),
            ].filter((item, index, list) => list.indexOf(item) === index);
          }

          // 手动字幕：无 fmt 默认返回的简单 XML 最干净；其次 srv3 / json3。
          return [
            withoutFmt(),
            withFmt('srv3'),
            withFmt('json3'),
            rawWithFmt('srv3'),
            raw(),
          ].filter((item, index, list) => list.indexOf(item) === index);
        };

        const decodeEntities = (text: string) =>
          text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#(\d+);/g, (_: string, code: string) =>
              String.fromCharCode(Number(code)),
            )
            .replace(/&#x([0-9a-fA-F]+);/g, (_: string, code: string) =>
              String.fromCharCode(Number.parseInt(code, 16)),
            );

        const normalizeText = (text: string) =>
          text.replace(/\s+/g, ' ').trim();

        type RawCue = { start: number; end: number; text: string };

        // 滚动字幕去重：YouTube 自动生成字幕 (含简单 XML 格式) 会输出
        // "hello" / "hello world" / "hello world this" 这种逐词增长、时间窗
        // 高度重叠的 cue。对翻译来说这是噪声 —— 我们只要每个滚动链最长的那条。
        // 同时把相邻 cue 的 end 钳到下一条的 start，避免重叠落到 overlay 的
        // find() 上拿到错的那条。
        const dedupeRollingCues = (cues: RawCue[]): RawCue[] => {
          if (cues.length === 0) return cues;
          const sorted = [...cues].sort(
            (a, b) => a.start - b.start || a.end - b.end,
          );
          const collapsed: RawCue[] = [];

          for (const cue of sorted) {
            const prev = collapsed[collapsed.length - 1];
            const overlapping = prev && cue.start < prev.end + 0.05;

            if (
              prev &&
              overlapping &&
              cue.text.length >= prev.text.length &&
              (cue.text === prev.text ||
                cue.text.startsWith(prev.text + ' ') ||
                cue.text.startsWith(prev.text))
            ) {
              // 把 prev 替换成更长的那条（同一滚动链的最后一帧）
              collapsed[collapsed.length - 1] = {
                start: prev.start,
                end: Math.max(prev.end, cue.end),
                text: cue.text,
              };
              continue;
            }

            if (prev && overlapping && prev.text.startsWith(cue.text + ' ')) {
              // cue 是 prev 的子串，丢弃 cue
              continue;
            }

            collapsed.push({ ...cue });
          }

          // 钳掉尾部对下一条的越界
          for (let i = 0; i < collapsed.length - 1; i += 1) {
            const next = collapsed[i + 1];
            if (collapsed[i].end > next.start) {
              collapsed[i].end = next.start;
            }
          }

          return collapsed.filter(
            (cue) => cue.end > cue.start && cue.text.length > 0,
          );
        };

        const finalize = (cues: RawCue[]): Array<RawCue & { id: string }> =>
          dedupeRollingCues(cues).map((cue, index) => ({
            id: `cue-${index + 1}`,
            ...cue,
          }));

        const parsePayload = (rawText: string) => {
          const trimmed = rawText.trim();
          if (!trimmed) {
            throw new Error('字幕接口返回空内容。');
          }

          try {
            const payload = JSON.parse(trimmed) as {
              events?: Array<{
                tStartMs?: number;
                dDurationMs?: number;
                aAppend?: number;
                segs?: Array<{ utf8?: string }>;
              }>;
            };

            // YouTube 自动生成字幕的 json3 格式以"窗口流"的形式工作：
            //   - 一个 aAppend !== 1 的事件 = 新开一行字幕（带第一段文本）
            //   - 之后多个 aAppend === 1 的事件 = 把后续单词累积到这一行
            //   - 段落本身可能是空的或者只是 "\n"（用作清屏标记）
            //
            // 之前的实现直接丢掉了 aAppend:1 事件，结果只剩"每行的第一个词"，
            // 翻译时丢失了一大堆内容。正确做法是把 aAppend 段累积回前一条 cue。
            const events = (payload.events ?? []).filter(
              (
                event,
              ): event is {
                tStartMs?: number;
                dDurationMs?: number;
                aAppend?: number;
                segs: Array<{ utf8?: string }>;
              } => Array.isArray(event.segs) && event.segs.length > 0,
            );

            const segText = (event: {
              segs: Array<{ utf8?: string }>;
            }): string => event.segs.map((seg) => seg.utf8 ?? '').join('');

            const rawCues: RawCue[] = [];
            let current: RawCue | null = null;

            for (const event of events) {
              const startMs = event.tStartMs ?? 0;
              const durMs = event.dDurationMs ?? 0;
              const text = segText(event);

              if (event.aAppend === 1 && current) {
                current.text += text;
                if (durMs > 0) {
                  current.end = Math.max(current.end, (startMs + durMs) / 1000);
                }
                continue;
              }

              if (current) {
                current.text = normalizeText(current.text);
                if (current.text && current.end > current.start) {
                  rawCues.push(current);
                }
              }

              current = {
                start: startMs / 1000,
                end: (startMs + Math.max(durMs, 0)) / 1000,
                text,
              };
            }

            if (current) {
              current.text = normalizeText(current.text);
              if (current.text && current.end > current.start) {
                rawCues.push(current);
              }
            }

            const jsonCues = finalize(rawCues);
            if (jsonCues.length > 0) {
              return jsonCues;
            }
          } catch {
            // Fall through to XML-based subtitle formats.
          }

          const xmlMatches = [
            ...trimmed.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g),
          ]
            .map((match) => {
              const attrs = match[1] ?? '';
              const body = match[2] ?? '';
              const start = Number((attrs.match(/start="([^"]+)"/) ?? [])[1]);
              const dur = Number((attrs.match(/dur="([^"]+)"/) ?? [])[1]);
              const text = normalizeText(
                decodeEntities(body.replace(/<[^>]+>/g, '')),
              );
              if (!Number.isFinite(start) || !Number.isFinite(dur) || !text)
                return null;
              return {
                start,
                end: start + dur,
                text,
              } satisfies RawCue;
            })
            .filter((cue): cue is RawCue => cue !== null);

          if (xmlMatches.length > 0) {
            const finalized = finalize(xmlMatches);
            if (finalized.length > 0) {
              return finalized;
            }
          }

          const srv3Matches = [
            ...trimmed.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g),
          ]
            .map((match) => {
              const attrs = match[1] ?? '';
              const body = match[2] ?? '';
              const startMs = Number((attrs.match(/t="([^"]+)"/) ?? [])[1]);
              const durMs = Number((attrs.match(/d="([^"]+)"/) ?? [])[1]);
              const text = normalizeText(
                decodeEntities(body.replace(/<[^>]+>/g, '')),
              );
              if (!Number.isFinite(startMs) || !Number.isFinite(durMs) || !text)
                return null;
              return {
                start: startMs / 1000,
                end: (startMs + durMs) / 1000,
                text,
              } satisfies RawCue;
            })
            .filter((cue): cue is RawCue => cue !== null);

          if (srv3Matches.length > 0) {
            const finalized = finalize(srv3Matches);
            if (finalized.length > 0) {
              return finalized;
            }
          }

          throw new Error(`无法识别字幕返回格式：${trimmed.slice(0, 120)}`);
        };

        const readTextRuns = (value: unknown): string => {
          const textValue = value as
            | {
                simpleText?: string;
                runs?: Array<{ text?: string }>;
              }
            | undefined;
          if (typeof textValue?.simpleText === 'string') {
            return textValue.simpleText;
          }
          if (Array.isArray(textValue?.runs)) {
            return textValue.runs.map((run) => run.text ?? '').join('');
          }
          return '';
        };

        const findTranscriptParams = (): string | null => {
          const stack: unknown[] = [
            (window as unknown as { ytInitialData?: unknown }).ytInitialData,
          ];
          const seen = new Set<unknown>();

          while (stack.length > 0 && seen.size < 30000) {
            const value = stack.pop();
            if (!value || typeof value !== 'object' || seen.has(value)) {
              continue;
            }
            seen.add(value);

            const candidate = value as {
              getTranscriptEndpoint?: { params?: unknown };
              commandMetadata?: {
                webCommandMetadata?: { apiUrl?: unknown };
              };
              params?: unknown;
            };

            if (
              typeof candidate.getTranscriptEndpoint?.params === 'string' &&
              candidate.getTranscriptEndpoint.params
            ) {
              return candidate.getTranscriptEndpoint.params;
            }
            if (
              candidate.commandMetadata?.webCommandMetadata?.apiUrl ===
                '/youtubei/v1/get_transcript' &&
              typeof candidate.params === 'string'
            ) {
              return candidate.params;
            }

            if (Array.isArray(value)) {
              stack.push(...value);
            } else {
              stack.push(...Object.values(value));
            }
          }

          return null;
        };

        const parseTranscriptResponse = (payload: unknown): RawCue[] => {
          const cues: RawCue[] = [];
          const stack = [payload];
          const seen = new Set<unknown>();

          while (stack.length > 0 && seen.size < 50000) {
            const value = stack.pop();
            if (!value || typeof value !== 'object' || seen.has(value)) {
              continue;
            }
            seen.add(value);

            const renderer = (
              value as {
                transcriptCueRenderer?: {
                  cue?: unknown;
                  startOffsetMs?: unknown;
                  durationMs?: unknown;
                };
              }
            ).transcriptCueRenderer;

            if (renderer) {
              const startMs = Number(renderer.startOffsetMs);
              const durationMs = Number(renderer.durationMs);
              const text = normalizeText(readTextRuns(renderer.cue));
              if (Number.isFinite(startMs) && text) {
                cues.push({
                  start: startMs / 1000,
                  end:
                    Number.isFinite(durationMs) && durationMs > 0
                      ? (startMs + durationMs) / 1000
                      : startMs / 1000 + 2,
                  text,
                });
              }
            }

            if (Array.isArray(value)) {
              stack.push(...value);
            } else {
              stack.push(...Object.values(value));
            }
          }

          const sorted = cues.sort((left, right) => left.start - right.start);
          for (let index = 0; index < sorted.length - 1; index += 1) {
            if (sorted[index].end <= sorted[index].start + 0.01) {
              sorted[index].end = sorted[index + 1].start;
            }
          }
          return sorted.filter((cue) => cue.end > cue.start && cue.text);
        };

        const fetchTranscriptViaInnertube = async (
          fallbackLanguage: string,
        ): Promise<{
          cues: Array<RawCue & { id: string }>;
          sourceLanguage: string;
        }> => {
          const ytcfg = (window as unknown as {
            ytcfg?: { get?: (key: string) => unknown };
          }).ytcfg;
          const apiKey = ytcfg?.get?.('INNERTUBE_API_KEY');
          const context = ytcfg?.get?.('INNERTUBE_CONTEXT');
          const clientVersion = (
            context as { client?: { clientVersion?: string } } | undefined
          )?.client?.clientVersion;
          const visitorData = ytcfg?.get?.('VISITOR_DATA');
          const params = findTranscriptParams();

          if (
            typeof apiKey !== 'string' ||
            !apiKey ||
            !context ||
            typeof params !== 'string' ||
            !params
          ) {
            throw new Error('未找到 YouTube transcript 接口参数。');
          }

          const response = await fetch(
            `/youtubei/v1/get_transcript?key=${encodeURIComponent(
              apiKey,
            )}&prettyPrint=false`,
            {
              method: 'POST',
              credentials: 'include',
              headers: {
                'content-type': 'application/json',
                ...(clientVersion
                  ? {
                      'x-youtube-client-name': '1',
                      'x-youtube-client-version': clientVersion,
                    }
                  : {}),
                ...(typeof visitorData === 'string'
                  ? { 'x-goog-visitor-id': visitorData }
                  : {}),
              },
              body: JSON.stringify({ context, params }),
            },
          );
          const text = await response.text();
          if (!response.ok) {
            throw new Error(
              `transcript HTTP ${response.status}: ${text.slice(0, 160)}`,
            );
          }

          const cues = finalize(parseTranscriptResponse(JSON.parse(text)));
          if (cues.length === 0) {
            throw new Error('transcript 接口返回为空。');
          }

          return {
            cues,
            sourceLanguage: fallbackLanguage || prefs.preferredLanguage || 'en',
          };
        };

        const tracks = buildTrackCandidates(input);
        const resultNode = document.createElement('script');
        resultNode.id = nodeId;
        resultNode.type = 'application/json';

        const trackSummaries = tracks.map((track) => ({
          languageCode: track.languageCode,
          kind: track.kind ?? '',
          name: trackName(track),
        }));

        try {
          if (tracks.length === 0) {
            throw new Error(
              '当前视频没有任何可用字幕轨。请在 YouTube 播放器右下角确认有 CC 按钮，并打开它。',
            );
          }

          const attempts: Array<{
            track: string;
            urlSuffix: string;
            status: number | null;
            length: number;
            error: string | null;
          }> = [];
          let lastError = null;

          for (const track of tracks) {
            for (const url of buildUrlVariants(track)) {
              const urlObj = new URL(url);
              // 显示 URL 末尾，这里能看到我们追加的 kind / lang / fmt 是否生效
              const tail = urlObj.search.slice(-160);
              const urlSuffix = `…${tail}`;
              const trackTag = `${track.languageCode}${track.kind ? `(${track.kind})` : ''}`;
              try {
                const response = await fetch(url, { credentials: 'include' });
                const text = response.ok ? await response.text() : '';
                attempts.push({
                  track: trackTag,
                  urlSuffix,
                  status: response.status,
                  length: text.length,
                  error: response.ok ? null : `HTTP ${response.status}`,
                });
                if (!response.ok) {
                  lastError = `HTTP ${response.status} (${trackTag})`;
                  continue;
                }
                if (!text.trim()) {
                  lastError = `空响应 (${trackTag})`;
                  continue;
                }
                const cues = parsePayload(text);
                if (cues.length > 0) {
                  resultNode.textContent = JSON.stringify({
                    ok: true,
                    data: {
                      cues,
                      sourceLanguage: track.languageCode,
                      discoveredTracks: trackSummaries,
                      attempts,
                    },
                  });
                  document.documentElement.append(resultNode);
                  return null;
                }
              } catch (error) {
                lastError =
                  error instanceof Error ? error.message : '字幕抓取失败。';
                attempts.push({
                  track: trackTag,
                  urlSuffix,
                  status: null,
                  length: 0,
                  error: lastError,
                });
              }
            }
          }

          try {
            const fallbackLanguage =
              tracks[0]?.languageCode ??
              input.captionTrack?.languageCode ??
              prefs.preferredLanguage;
            const transcript = await fetchTranscriptViaInnertube(fallbackLanguage);
            resultNode.textContent = JSON.stringify({
              ok: true,
              data: {
                cues: transcript.cues,
                sourceLanguage: transcript.sourceLanguage,
                discoveredTracks: trackSummaries,
                attempts,
                source: 'youtubei-transcript',
              },
            });
            document.documentElement.append(resultNode);
            return null;
          } catch (transcriptError) {
            lastError =
              transcriptError instanceof Error
                ? transcriptError.message
                : 'transcript 接口抓取失败。';
            attempts.push({
              track: 'transcript',
              urlSuffix: 'youtubei/get_transcript',
              status: null,
              length: 0,
              error: lastError,
            });
          }

          // 所有 URL 都失败时把每次尝试的诊断信息塞进错误，方便排查
          // YouTube 端到底为啥不返回内容（HTTP 状态码 / 响应大小 / URL 尾部）。
          const diag = attempts
            .map(
              (item) =>
                `${item.track} ${item.urlSuffix} → ${
                  item.status ?? 'no-response'
                } len=${item.length}${item.error ? ` ${item.error}` : ''}`,
            )
            .join(' || ');
          throw new Error(
            `${lastError ?? '字幕抓取失败。'} 已尝试 ${attempts.length} 次：${diag}`,
          );
        } catch (error) {
          resultNode.textContent = JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : '字幕抓取失败。',
            discoveredTracks: trackSummaries,
          });
          document.documentElement.append(resultNode);
          return null;
        }
      },
      args: [payload, resultNodeId, trackPreferences] as [
        SourceSubtitlesPayload,
        string,
        { preferredLanguage: string; allowAutoGenerated: boolean },
      ],
    });

    const resultReadback = await chrome.scripting.executeScript({
      target: { tabId },
      func: (nodeId) => {
        const node = document.getElementById(nodeId);
        const text = node?.textContent ?? null;
        node?.remove();
        return text;
      },
      args: [resultNodeId],
    });

    const rawResult = resultReadback[0]?.result;
    if (!rawResult) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'source-subtitles.empty-result',
        details: summarizeUnknown(resultReadback),
      });
      throw new Error('页面上下文没有返回字幕结果。');
    }

    let parsedResult:
      | { ok: true; data: SourceSubtitlesResponse }
      | { ok: false; error: string };

    try {
      parsedResult = JSON.parse(rawResult) as
        | { ok: true; data: SourceSubtitlesResponse }
        | { ok: false; error: string };
    } catch (error) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'source-subtitles.invalid-json',
        details: summarizeUnknown({ rawResult, error }),
      });
      throw new Error('页面字幕抓取结果不是合法 JSON。');
    }

    if (!parsedResult.ok) {
      await appendDebugLog({
        level: 'error',
        source: 'background',
        event: 'source-subtitles.fetch-error',
        details: summarizeUnknown(parsedResult),
      });
      throw new Error(parsedResult.error);
    }

    await appendDebugLog({
      level: 'info',
      source: 'background',
      event: 'source-subtitles.success',
      details: summarizeUnknown({
        sourceLanguage: parsedResult.data.sourceLanguage,
        cueCount: parsedResult.data.cues?.length,
        firstCue: parsedResult.data.cues?.[0],
      }),
    });
    return parsedResult.data;
  }

  private async handleAiSummarize(
    payload: AiSummarizePayload,
  ): Promise<AiSummarizeResponse> {
    const settings = await this.getSettings();
    const provider = settings.llm.providers.find((p) => p.id === settings.llm.activeProviderId);
    if (!provider) return { ok: false, error: '未配置 AI 模型。请在翻译设置中添加并激活一个 provider。' };

    const prompt = payload.deepThink
      ? '请深度分析以下视频字幕内容，给出详细的总结和见解。包括：1) 主要内容概述 2) 关键观点和论点 3) 值得深入思考的问题。用中文回答。'
      : '请用中文总结以下视频字幕的核心内容，简洁精炼，不超过 500 字。';

    const chat = createProvider(provider);
    const response = await chat.chat({
      model: 'model' in provider ? provider.model : '',
      system: prompt,
      messages: [{ role: 'user', content: payload.subtitleText.slice(0, 8000) }],
      temperature: payload.deepThink ? 0.8 : 0.5,
      maxTokens: payload.deepThink ? 2000 : 800,
    });

    return { ok: true, summary: response.text };
  }

  private async handleAiAsk(
    payload: AiAskPayload,
  ): Promise<AiAskResponse> {
    const settings = await this.getSettings();
    const provider = settings.llm.providers.find((p) => p.id === settings.llm.activeProviderId);
    if (!provider) return { ok: false, error: '未配置 AI 模型。' };

    const context = payload.context?.slice(0, 3000) ?? '';
    const chat = createProvider(provider);
    const response = await chat.chat({
      model: 'model' in provider ? provider.model : '',
      system: '你是一个帮助用户理解视频内容的智能助手。根据用户选中的文字和相关上下文，给出简洁有用的回答。用中文回复。',
      messages: [{ role: 'user', content: `上下文：${context}\n\n用户选中：${payload.selectedText ?? ''}\n\n用户问题：${payload.question}` }],
      temperature: 0.6,
      maxTokens: 600,
    });

    return { ok: true, answer: response.text };
  }

  private async handleAiTranscribe(
    payload: AiTranscribePayload,
  ): Promise<AiTranscribeResponse> {
    const settings = await this.getSettings();
    const provider = settings.llm.providers.find((p) => p.id === settings.llm.activeProviderId);
    if (!provider) return { ok: false, error: '未配置 AI 模型。' };

    const text = payload.cues.map((c) => c.text).join('\n');
    const chat = createProvider(provider);
    const response = await chat.chat({
      model: 'model' in provider ? provider.model : '',
      system: '请优化以下转录文字，使其更通顺、分段合理。保持原始含义不变。输出格式：每行一个段落。',
      messages: [{ role: 'user', content: text.slice(0, 6000) }],
      temperature: 0.4,
      maxTokens: 2000,
    });

    return { ok: true, segments: [{ start: 0, text: response.text }] };
  }
}
