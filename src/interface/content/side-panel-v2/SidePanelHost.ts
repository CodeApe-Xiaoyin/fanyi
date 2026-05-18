import type { BilingualCue } from '@/domain/models/Cue';
import type { AppSettings } from '@/shared/types';
import { PANEL_CSS } from './side-panel-styles';

export class SidePanelHost {
  private host: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private root: ReturnType<typeof import('react-dom/client')['createRoot']> | null = null;
  private visible = false;
  private cues: BilingualCue[] = [];

  constructor(
    private video: HTMLVideoElement,
    private player: HTMLElement,
    private settings: AppSettings,
  ) {}

  show(): void {
    if (this.visible) return;
    this.visible = true;

    this.host = document.createElement('div');
    this.host.style.cssText = 'all:initial;';
    this.shadowRoot = this.host.attachShadow({ mode: 'closed' });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(PANEL_CSS);
    this.shadowRoot.adoptedStyleSheets = [sheet];

    this.mountToDOM();

    void this.renderReact();
  }

  hide(): void {
    this.visible = false;
    this.root?.unmount();
    this.host?.remove();
    this.host = null;
    this.shadowRoot = null;
    this.root = null;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  isVisible(): boolean { return this.visible; }

  setData(cues: BilingualCue[], settings: AppSettings): void {
    this.cues = cues;
    this.settings = settings;
    void this.renderReact();
  }

  destroy(): void { this.hide(); }

  private mountToDOM(): void {
    const primary = document.querySelector('ytd-watch-flexy #primary');
    if (primary) {
      primary.append(this.host!);
      this.host!.style.cssText = 'width:380px;flex-shrink:0;height:100%;';
    } else {
      this.host!.style.cssText = 'position:fixed;top:0;right:0;width:380px;height:100vh;z-index:2147483645;';
      document.body.append(this.host!);
    }
  }

  private async renderReact(): Promise<void> {
    if (!this.shadowRoot || !this.visible) return;

    const [React, { createRoot }, { SidePanelApp }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('./SidePanelApp'),
    ]);

    if (!this.shadowRoot || !this.visible) return;

    const container = this.shadowRoot.querySelector('[data-panel-root]') ??
      (() => { const d = document.createElement('div'); d.dataset.panelRoot = 'true'; this.shadowRoot!.append(d); return d; })();

    if (!this.root) {
      this.root = createRoot(container);
    }

    this.root.render(
      React.createElement(SidePanelApp, {
        cues: this.cues,
        video: this.video,
        settings: this.settings,
      }),
    );
  }
}
