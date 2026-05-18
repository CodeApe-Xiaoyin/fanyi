import { buildContainer } from '@/composition/container';
import { DEFAULT_ENV } from '@/composition/env';
import { logger } from '@/shared/logger';
import type { AnyMessageEnvelope } from '@/shared/types';

import { MessageRouter } from './message-router';

const container = buildContainer(DEFAULT_ENV);
const router = new MessageRouter(container);

function isFanyiMessage(message: unknown): message is AnyMessageEnvelope {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof message.type === 'string' &&
    message.type.startsWith('fanyi/')
  );
}

chrome.runtime.onInstalled.addListener(() => {
  logger.info('Service worker installed.');
});

// Handle direct messages (quick operations only)
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isFanyiMessage(message)) {
    return undefined;
  }

  void router
    .handle(message, _sender.tab?.id)
    .then((result) => sendResponse(result))
    .catch((error) => {
      logger.error('Message handling failed.', error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unhandled background error.',
      });
    });

  return true;
});

// Handle port-based connections for long-running operations
// This bypasses Chrome's 90-second sendMessage timeout
chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((message: unknown) => {
    if (!isFanyiMessage(message)) {
      port.postMessage({ ok: false, error: 'Invalid message' });
      return;
    }

    void router
      .handle(message, undefined)
      .then((result) => {
        port.postMessage(result);
      })
      .catch((error) => {
        logger.error('Port message handling failed.', error);
        port.postMessage({
          ok: false,
          error: error instanceof Error ? error.message : 'Unhandled background error.',
        });
      });
  });
});
