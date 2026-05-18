interface PlayerControlButtonOptions {
  player: HTMLElement;
  enabled: boolean;
  onToggle: (enabled: boolean) => void | Promise<void>;
}

const CONTROL_SELECTOR = '[data-fanyi-player-control="true"]';
const STYLE_ID = 'fanyi-player-control-style';

export class PlayerControlButton {
  private readonly button: HTMLButtonElement;

  private readonly observer: MutationObserver;

  private retryTimer: number | null = null;

  private mountAttempts = 0;

  private enabled: boolean;

  private busy = false;

  constructor(private readonly options: PlayerControlButtonOptions) {
    this.enabled = options.enabled;
    ensureControlStyle();

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'ytp-button fanyi-player-control';
    this.button.dataset.fanyiPlayerControl = 'true';

    const label = document.createElement('span');
    label.className = 'fanyi-player-control-label';
    label.textContent = '\u8bd1';
    this.button.append(label);

    this.button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.toggle();
    });

    this.observer = new MutationObserver(() => this.mount());
    this.observer.observe(options.player, {
      childList: true,
      subtree: true,
    });

    this.syncState();
    this.mount();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.busy = false;
    this.syncState();
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.syncState();
  }

  destroy(): void {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.observer.disconnect();
    this.button.remove();
  }

  private async toggle(): Promise<void> {
    if (this.busy) return;

    const nextEnabled = !this.enabled;
    this.setBusy(true);
    try {
      await this.options.onToggle(nextEnabled);
      this.setEnabled(nextEnabled);
    } catch {
      this.setBusy(false);
    }
  }

  private mount(): void {
    const controls = this.options.player.querySelector<HTMLElement>(
      '.ytp-right-controls',
    );

    if (!controls) {
      this.scheduleRetry();
      return;
    }

    const existing =
      controls.querySelector<HTMLButtonElement>(CONTROL_SELECTOR);
    if (existing && existing !== this.button) {
      existing.remove();
    }

    if (this.button.parentElement === controls) {
      return;
    }

    const subtitlesButton = findDirectChildByClass(
      controls,
      'ytp-subtitles-button',
    );
    controls.insertBefore(this.button, subtitlesButton ?? controls.firstChild);
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null || this.mountAttempts >= 24) return;

    this.mountAttempts += 1;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.mount();
    }, 250);
  }

  private syncState(): void {
    this.button.dataset.fanyiEnabled = String(this.enabled);
    this.button.dataset.fanyiBusy = String(this.busy);
    this.button.disabled = this.busy;
    this.button.setAttribute('aria-pressed', String(this.enabled));
    this.button.title = this.enabled ? 'Fanyi on' : 'Fanyi off';
    this.button.setAttribute('aria-label', this.button.title);
  }
}

function findDirectChildByClass(
  parent: HTMLElement,
  className: string,
): HTMLElement | null {
  for (const child of parent.children) {
    if (child instanceof HTMLElement && child.classList.contains(className)) {
      return child;
    }
  }

  return null;
}

function ensureControlStyle(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .fanyi-player-control {
      align-items: center !important;
      display: inline-flex !important;
      justify-content: center !important;
      position: relative !important;
    }

    .fanyi-player-control-label {
      color: rgba(255, 255, 255, 0.88);
      display: inline-grid;
      font: 700 18px/1 system-ui, sans-serif;
      height: 28px;
      place-items: center;
      text-decoration: none;
      width: 28px;
    }

    .fanyi-player-control[data-fanyi-enabled="true"]
      .fanyi-player-control-label {
      color: #ff4d4d;
      text-decoration: underline;
      text-decoration-color: #ff4d4d;
      text-decoration-thickness: 2px;
      text-underline-offset: 5px;
    }

    .fanyi-player-control[data-fanyi-busy="true"]
      .fanyi-player-control-label {
      opacity: 0.55;
    }
  `;
  document.head.append(style);
}
