import type { AppSettings, SubtitleStyle } from '@/shared/types';
import { getSettings, updateStyleSettings } from './messaging';

type SettingsPanelType = Awaited<ReturnType<typeof import('@/interface/shared-ui/settings-panel/SettingsPanel')['SettingsPanel']>>;

export class SettingsModal {
  private host: HTMLDivElement | null = null;
  private root: ReturnType<typeof import('react-dom/client')['createRoot']> | null = null;
  private panel: SettingsPanelType | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private visible = false;

  show(settings: AppSettings): void {
    if (this.visible) return;
    this.visible = true;

    this.host = document.createElement('div');
    this.host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
    this.shadowRoot = this.host.attachShadow({ mode: 'closed' });

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.6);';
    backdrop.addEventListener('click', () => this.hide());
    this.shadowRoot.append(backdrop);

    document.body.append(this.host);

    void this.renderPanel();
  }

  hide(): void {
    this.visible = false;
    this.root?.unmount();
    this.host?.remove();
    this.host = null;
    this.shadowRoot = null;
    this.root = null;
  }

  isVisible(): boolean {
    return this.visible;
  }

  private async renderPanel(): Promise<void> {
    const [React, { createRoot }, { SettingsPanel }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@/interface/shared-ui/settings-panel/SettingsPanel'),
    ]);

    if (!this.shadowRoot || !this.visible) return;

    const container = document.createElement('div');
    this.shadowRoot.append(container);

    const handleStyleChange = async (patch: Partial<SubtitleStyle>) => {
      return updateStyleSettings(patch);
    };

    const handleClose = () => this.hide();

    this.root = createRoot(container);
    this.root.render(
      React.createElement(SettingsPanel, {
        settings: (await getSettings()) as AppSettings,
        onSettingsChange: () => { void getSettings(); },
        onStyleChange: handleStyleChange,
        onClose: handleClose,
      }),
    );
  }
}
