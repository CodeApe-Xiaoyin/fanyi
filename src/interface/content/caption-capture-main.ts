type FanyiCapturedCaption = {
  url: string;
  text: string;
  capturedAt: number;
};

type FanyiCaptureWindow = Window & {
  __fanyiCaptureInstalled?: boolean;
  __fanyiCapturedCaptions?: FanyiCapturedCaption[];
  __fanyiFlushCapturedCaptions?: () => void;
};

(() => {
  const win = window as FanyiCaptureWindow;
  if (win.__fanyiCaptureInstalled) {
    win.__fanyiFlushCapturedCaptions?.();
    return;
  }
  win.__fanyiCaptureInstalled = true;

  const TIMEDTEXT_MARK = '/api/timedtext';

  const postCapture = (capture: FanyiCapturedCaption): void => {
    try {
      window.postMessage(
        {
          __fanyi: 'caption-captured',
          ...capture,
        },
        '*',
      );
    } catch {
      // Do not let capture diagnostics affect YouTube playback.
    }
  };

  const rememberCapture = (url: string, text: string): void => {
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

  const readXhrResponseText = async (xhr: XMLHttpRequest): Promise<string> => {
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

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(...args) {
    const response = await originalFetch(...args);
    try {
      const input = args[0];
      const url = input instanceof Request ? input.url : String(input ?? '');
      if (url.includes(TIMEDTEXT_MARK) && response.ok) {
        response
          .clone()
          .text()
          .then((text) => rememberCapture(url, text))
          .catch(() => {
            /* ignore clone failures */
          });
      }
    } catch {
      /* never let our wrapper break the page */
    }
    return response;
  };

  const xhrProto = XMLHttpRequest.prototype as unknown as {
    open: XMLHttpRequest['open'];
    send: XMLHttpRequest['send'];
  };
  const originalOpen = xhrProto.open;
  const originalSend = xhrProto.send;

  xhrProto.open = function (
    this: XMLHttpRequest & { __fanyiUrl?: string },
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__fanyiUrl = String(url);
    return originalOpen.apply(this, [method, url, ...rest] as Parameters<
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
            if (this.status >= 200 && this.status < 300) {
              rememberCapture(this.__fanyiUrl ?? '', text);
            }
          })
          .catch(() => {
            /* swallow */
          });
      });
    }

    return originalSend.apply(this, args);
  } as XMLHttpRequest['send'];
})();
