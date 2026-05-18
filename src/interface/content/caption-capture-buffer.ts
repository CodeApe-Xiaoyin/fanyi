import { appendDebugLog, summarizeUnknown } from '@/shared/debug-log';

import { requestInstallCaptureHook } from './messaging';

interface CapturedCaption {
  url: string;
  text: string;
  capturedAt: number;
}

const captureBuffer: CapturedCaption[] = [];
const captureWaiters: Array<(value: CapturedCaption) => boolean> = [];
let captureHookPromise: Promise<void> | null = null;
let captureListenerInstalled = false;

export async function ensureCaptureHook(): Promise<void> {
  captureHookPromise ??= installCaptureHook();
  await captureHookPromise;
}

export function discardCapturesFromOtherVideos(videoId: string): void {
  for (let index = captureBuffer.length - 1; index >= 0; index -= 1) {
    const capturedVideoId = getCapturedVideoId(captureBuffer[index]);
    if (capturedVideoId && capturedVideoId !== videoId) {
      captureBuffer.splice(index, 1);
    }
  }
}

export function waitForNextCapture(
  timeoutMs: number,
  videoId: string,
): Promise<CapturedCaption | null> {
  const buffered = takeBufferedCapture(videoId);
  if (buffered) {
    return Promise.resolve(buffered);
  }

  return new Promise((resolve) => {
    let timeoutId = 0;
    let settled = false;
    const waiter = (value: CapturedCaption): boolean => {
      if (!captureMatchesVideo(value, videoId)) {
        return false;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      resolve(value);
      return true;
    };
    timeoutId = window.setTimeout(() => {
      if (settled) return;
      const index = captureWaiters.indexOf(waiter);
      if (index !== -1) captureWaiters.splice(index, 1);
      resolve(null);
    }, timeoutMs);

    captureWaiters.push(waiter);
  });
}

function pushCapture(capture: CapturedCaption): void {
  captureBuffer.push(capture);
  while (captureBuffer.length > 8) {
    captureBuffer.shift();
  }

  const pending = captureWaiters.splice(0);
  for (const waiter of pending) {
    const accepted = waiter(capture);
    if (!accepted) {
      captureWaiters.push(waiter);
    }
  }

  void appendDebugLog({
    level: 'info',
    source: 'content',
    event: 'content.caption-captured',
    details: summarizeUnknown({
      url: capture.url,
      length: capture.text.length,
      videoId: getCapturedVideoId(capture),
    }),
  });
}

function takeBufferedCapture(videoId: string): CapturedCaption | null {
  for (let index = captureBuffer.length - 1; index >= 0; index -= 1) {
    const capture = captureBuffer[index];
    if (!captureMatchesVideo(capture, videoId)) continue;

    captureBuffer.splice(index, 1);
    return capture;
  }

  return null;
}

function captureMatchesVideo(capture: CapturedCaption, videoId: string): boolean {
  const capturedVideoId = getCapturedVideoId(capture);
  return !capturedVideoId || capturedVideoId === videoId;
}

function getCapturedVideoId(capture: CapturedCaption): string | null {
  try {
    return new URL(capture.url).searchParams.get('v');
  } catch {
    try {
      return new URL(capture.url, location.origin).searchParams.get('v');
    } catch {
      return null;
    }
  }
}

function installCaptureListener(): void {
  if (captureListenerInstalled) return;
  captureListenerInstalled = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as {
      __fanyi?: string;
      url?: string;
      text?: string;
      capturedAt?: number;
    } | null;
    if (!data || data.__fanyi !== 'caption-captured') return;
    if (typeof data.url !== 'string' || typeof data.text !== 'string') return;
    if (!data.text.trim()) return;

    pushCapture({
      url: data.url,
      text: data.text,
      capturedAt: data.capturedAt ?? Date.now(),
    });
  });
}

async function installCaptureHook(): Promise<void> {
  installCaptureListener();
  try {
    const result = await requestInstallCaptureHook();
    if (!result.ok) {
      throw new Error(result.error);
    }
  } catch (error) {
    captureHookPromise = null;
    void appendDebugLog({
      level: 'warn',
      source: 'content',
      event: 'content.install-capture-hook-failed',
      details: summarizeUnknown(error),
    });
  }
}
