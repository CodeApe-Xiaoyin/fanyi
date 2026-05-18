import type { AppSettings, SubtitleStyle } from '@/shared/types';
import { getSettings, updateStyleSettings } from './messaging';

const MODAL_CSS = `
:host{all:initial}
.modal-backdrop{
  position:fixed;inset:0;z-index:2147483647;
  background:rgba(20,20,19,0.38);
  backdrop-filter:blur(4px);
  -webkit-backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;
  animation:fadeIn 180ms ease;
}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
`;

export class SettingsModal {
  private host: HTMLDivElement | null = null;
  private root: ReturnType<typeof import('react-dom/client')['createRoot']> | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private visible = false;

  show(settings: AppSettings): void {
    if (this.visible) return;
    this.visible = true;

    this.host = document.createElement('div');
    this.shadowRoot = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = MODAL_CSS;
    this.shadowRoot.append(style);

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.hide();
    });
    this.shadowRoot.append(backdrop);

    const container = document.createElement('div');
    backdrop.append(container);

    document.body.append(this.host);
    void this.renderPanel(container);
  }

  hide(): void {
    this.visible = false;
    this.root?.unmount();
    this.host?.remove();
    this.host = null;
    this.shadowRoot = null;
    this.root = null;
  }

  isVisible(): boolean { return this.visible; }

  private async renderPanel(container: HTMLDivElement): Promise<void> {
    const [React, { createRoot }, { SettingsPanel }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@/interface/shared-ui/settings-panel/SettingsPanel'),
    ]);

    if (!this.shadowRoot || !this.visible) return;

    const handleStyleChange = async (patch: Partial<SubtitleStyle>) => {
      return updateStyleSettings(patch);
    };

    this.root = createRoot(container);
    this.root.render(
      React.createElement(SettingsPanel, {
        settings: (await getSettings()) as AppSettings,
        onSettingsChange: () => { void getSettings(); },
        onStyleChange: handleStyleChange,
        onClose: () => this.hide(),
      }),
    );
  }
}
