import type {
  AppSettings,
  AiPolishBatchPayload,
  AiPolishBatchResponse,
  CacheState,
  DebugLogEntry,
  EnsureCaptionsPayload,
  EnsureCaptionsResponse,
  InstallCaptureHookResponse,
  InstantTranslatePayload,
  InstantTranslateResponse,
  MessageEnvelope,
  MessageMap,
  MessageType,
  LiveTranslatePayload,
  LiveTranslateResponse,
  ParseCapturedCaptionPayload,
  ParseCapturedCaptionResponse,
  PipelinePayload,
  PipelineResponse,
  ProviderConfig,
  ProviderTestResponse,
  SourceSubtitlesPayload,
  SourceSubtitlesResponse,
  SubtitleCachePutPayload,
  SubtitleCachePutResponse,
} from '@/shared/types';

function sendMessage<T extends MessageType, R = unknown>(
  type: T,
  payload: MessageMap[T],
): Promise<R> {
  return chrome.runtime.sendMessage({
    type,
    payload,
  } satisfies MessageEnvelope<T>) as Promise<R>;
}

/**
 * Send message using Port for long-running operations that might exceed Chrome's
 * 90-second sendMessage timeout. The service worker communicates back via port.postMessage
 * which has no time limit.
 */
function sendMessageViaPort<T extends MessageType, R = unknown>(
  type: T,
  payload: MessageMap[T],
): Promise<R> {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'fanyi-long-operation' });

    const timeoutHandle = setTimeout(() => {
      port.disconnect();
      reject(new Error(`Message '${type}' timed out after 5 minutes`));
    }, 300000); // 5 minutes

    const onMessage = (response: unknown) => {
      clearTimeout(timeoutHandle);
      port.onMessage.removeListener(onMessage);
      port.disconnect();
      resolve(response as R);
    };

    const onError = () => {
      clearTimeout(timeoutHandle);
      port.onMessage.removeListener(onMessage);
      reject(new Error(`Port connection failed for '${type}'`));
    };

    port.onDisconnect.addListener(onError);
    port.onMessage.addListener(onMessage);
    port.postMessage({
      type,
      payload,
    } satisfies MessageEnvelope<T>);
  });
}

export function requestPipeline(payload: PipelinePayload): Promise<PipelineResponse> {
  // Use port-based messaging for pipeline since it can take longer than 90 seconds
  return sendMessageViaPort('fanyi/pipeline-run', payload);
}

export function requestSourceSubtitles(
  payload: SourceSubtitlesPayload,
): Promise<SourceSubtitlesResponse | { ok: false; error: string }> {
  // Service worker 失败时会以 `{ok:false,error}` 形式回包（见 service-worker.ts 的
  // catch 分支）。我们故意把这个联合类型暴露给上层，让它自己决定是退化到
  // 实时翻译模式还是直接报错——不要在这里 throw 把分支信息吃掉。
  return sendMessage('fanyi/source-subtitles-fetch', payload) as Promise<
    SourceSubtitlesResponse | { ok: false; error: string }
  >;
}

export function requestLiveTranslate(
  payload: LiveTranslatePayload,
): Promise<LiveTranslateResponse | { ok: false; error: string }> {
  return sendMessage('fanyi/live-translate', payload);
}

export function requestInstantTranslate(
  payload: InstantTranslatePayload,
): Promise<InstantTranslateResponse> {
  return sendMessage('fanyi/instant-translate', payload);
}

export function requestAiPolishBatch(
  payload: AiPolishBatchPayload,
): Promise<AiPolishBatchResponse> {
  return sendMessageViaPort('fanyi/ai-polish-batch', payload);
}

export function requestSubtitleCachePut(
  payload: SubtitleCachePutPayload,
): Promise<SubtitleCachePutResponse> {
  return sendMessage('fanyi/subtitle-cache-put', payload);
}

export function requestEnsureCaptions(
  payload: EnsureCaptionsPayload,
): Promise<EnsureCaptionsResponse> {
  return sendMessage('fanyi/ensure-captions', payload);
}

export function requestInstallCaptureHook(): Promise<InstallCaptureHookResponse> {
  return sendMessage('fanyi/install-capture-hook', undefined);
}

export function requestParseCapturedCaption(
  payload: ParseCapturedCaptionPayload,
): Promise<ParseCapturedCaptionResponse> {
  return sendMessage('fanyi/parse-captured-caption', payload);
}

export function getSettings(): Promise<AppSettings> {
  return sendMessage('fanyi/settings-get', undefined);
}

export function getDebugLogs(): Promise<DebugLogEntry[]> {
  return sendMessage('fanyi/debug-logs-get', undefined);
}

export function clearDebugLogs(): Promise<void> {
  return sendMessage('fanyi/debug-logs-clear', undefined);
}

export function getCacheState(): Promise<CacheState> {
  return sendMessage('fanyi/cache-get', undefined);
}

export function clearCache(): Promise<CacheState> {
  return sendMessage('fanyi/cache-clear', undefined);
}

export function updateSettings(
  patch: MessageMap['fanyi/settings-update'],
): Promise<AppSettings> {
  return sendMessage('fanyi/settings-update', patch);
}

export function updateStyleSettings(patch: Partial<AppSettings['style']>): Promise<AppSettings> {
  return sendMessage('fanyi/style-update', patch);
}

export function upsertProvider(provider: ProviderConfig): Promise<AppSettings> {
  return sendMessage('fanyi/provider-upsert', provider);
}

export function activateProvider(providerId: string): Promise<AppSettings> {
  return sendMessage('fanyi/provider-activate', { providerId });
}

export function deleteProvider(providerId: string): Promise<AppSettings> {
  return sendMessage('fanyi/provider-delete', { providerId });
}

export function testProvider(provider: ProviderConfig): Promise<ProviderTestResponse> {
  return sendMessage('fanyi/provider-test', provider);
}

export function updateEnabled(enabled: boolean): Promise<AppSettings> {
  return sendMessage('fanyi/enabled-update', { enabled });
}
