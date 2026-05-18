import type { CaptionTrack, VideoContext } from '@/shared/types';

export interface BoundVideoContext {
  context: VideoContext;
  player: HTMLElement;
  video: HTMLVideoElement;
}

export function bindYouTubePlayer(
  onVideoReady: (binding: BoundVideoContext) => void,
): () => void {
  let currentVideoId = '';
  let currentVideo: HTMLVideoElement | null = null;
  let currentPlayer: HTMLElement | null = null;
  let triggerInFlight = false;
  let retriggerRequested = false;
  let disposed = false;

  const trigger = async (): Promise<void> => {
    if (triggerInFlight) {
      retriggerRequested = true;
      return;
    }

    triggerInFlight = true;
    try {
      await triggerOnce();
    } finally {
      triggerInFlight = false;
      if (retriggerRequested && !disposed) {
        retriggerRequested = false;
        void trigger();
      }
    }
  };

  const triggerOnce = async (): Promise<void> => {
    if (disposed) {
      return;
    }

    const videoId = extractVideoId(location.href);
    if (!videoId) {
      return;
    }

    const video = await waitForVideo();
    if (!video) {
      return;
    }

    const player = findPlayer(video);
    if (!player) {
      return;
    }

    const sameBinding =
      videoId === currentVideoId &&
      video === currentVideo &&
      player === currentPlayer &&
      document.documentElement.contains(video) &&
      document.documentElement.contains(player) &&
      Boolean(
        player.querySelector(
          '[data-fanyi-host="true"], [data-fanyi-player-control="true"]',
        ),
      );
    if (sameBinding) {
      return;
    }

    // SPA navigation: ytInitialPlayerResponse may not yet be rendered into <script> tags.
    // Retry up to ~3s before giving up and proceeding with empty tracks.
    let captionTracks = extractCaptionTracks();
    if (captionTracks.length === 0) {
      for (let attempt = 0; attempt < 5 && !disposed; attempt += 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 600));
        captionTracks = extractCaptionTracks();
        if (captionTracks.length > 0) {
          break;
        }
      }
    }

    const context = buildVideoContext(videoId, captionTracks);

    currentVideoId = videoId;
    currentVideo = video;
    currentPlayer = player;
    onVideoReady({ context, player, video });
  };

  const observer = new MutationObserver(() => {
    void trigger();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  const intervalId = window.setInterval(() => {
    void trigger();
  }, 1200);

  void trigger();

  return () => {
    disposed = true;
    observer.disconnect();
    window.clearInterval(intervalId);
  };
}

function extractVideoId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

async function waitForVideo(): Promise<HTMLVideoElement | null> {
  for (let index = 0; index < 20; index += 1) {
    const video = document.querySelector('video');
    if (video instanceof HTMLVideoElement) {
      return video;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return null;
}

function findPlayer(video: HTMLVideoElement): HTMLElement | null {
  return (
    video.closest('.html5-video-player') ??
    document.querySelector('#movie_player') ??
    video.parentElement
  );
}

function buildVideoContext(
  videoId: string,
  captionTracks: CaptionTrack[],
): VideoContext {
  const title =
    document.querySelector('ytd-watch-metadata h1')?.textContent?.trim() ??
    document.title.replace(/\s*-\s*YouTube$/, '');
  const channel =
    document.querySelector('#channel-name a')?.textContent?.trim() ??
    document.querySelector('ytd-channel-name a')?.textContent?.trim() ??
    undefined;

  return { videoId, title, channel, captionTracks };
}

function extractCaptionTracks(): CaptionTrack[] {
  const scriptTexts = [...document.querySelectorAll('script')]
    .map((script) => script.textContent ?? '')
    .filter((text) => text.includes('captionTracks'));

  for (const scriptText of scriptTexts) {
    const tracks = parseCaptionTracksFromScript(scriptText);
    if (tracks.length > 0) {
      return tracks;
    }
  }

  return [];
}

// Uses bracket-counting instead of a regex to robustly extract the captionTracks array,
// because nested arrays in name.runs fields can cause a non-greedy regex to terminate early.
function parseCaptionTracksFromScript(scriptText: string): CaptionTrack[] {
  const keyIndex = scriptText.indexOf('"captionTracks"');
  if (keyIndex === -1) {
    return [];
  }

  const arrayStart = scriptText.indexOf('[', keyIndex);
  if (arrayStart === -1) {
    return [];
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = arrayStart; i < scriptText.length; i += 1) {
    const ch = scriptText[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          const rawTracks = JSON.parse(
            scriptText.slice(arrayStart, i + 1),
          ) as Array<{
            baseUrl: string;
            languageCode: string;
            kind?: string;
            vssId?: string;
            name?: { simpleText?: string; runs?: Array<{ text?: string }> };
          }>;

          return rawTracks
            .filter(
              (track) =>
                typeof track.baseUrl === 'string' && track.baseUrl.length > 0,
            )
            .map((track) => ({
              baseUrl: track.baseUrl,
              languageCode: track.languageCode,
              kind: track.kind,
              vssId: track.vssId,
              name:
                track.name?.simpleText ??
                track.name?.runs?.map((item) => item.text ?? '').join('') ??
                track.languageCode,
            }));
        } catch {
          return [];
        }
      }
    }
  }

  return [];
}
