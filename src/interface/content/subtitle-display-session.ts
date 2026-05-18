import type { BilingualCue } from '@/domain/models/Cue';
import type { SubtitleStyle } from '@/domain/models/SubtitleStyle';
import type { AppSettings } from '@/shared/types';

import { SubtitleOverlay } from './subtitle-overlay';

interface SubtitleDisplaySessionOptions {
  player: HTMLElement;
  video: HTMLVideoElement;
  onPositionChange?: (next: {
    leftPercent: number;
    topPercent: number;
  }) => void;
  onStyleChange?: (patch: Partial<SubtitleStyle>) => void;
  onOpenSettings?: () => void;
  onWordClick?: (word: string, rect: DOMRect) => void;
}

export class SubtitleDisplaySession {
  private readonly overlay: SubtitleOverlay;

  private style: SubtitleStyle | null = null;

  private sidePanelHost: import('./side-panel-v2/SidePanelHost').SidePanelHost | null = null;
  private sidePanelLoaded = false;
  private wordPopup: import('./word-popup/WordPopup').WordPopup | null = null;

  constructor(private readonly options: SubtitleDisplaySessionOptions) {
    this.overlay = new SubtitleOverlay(options.player);
    this.overlay.onPositionChange = options.onPositionChange;
    this.overlay.onStyleChange = options.onStyleChange;
    this.overlay.onOpenSettings = options.onOpenSettings;
    this.overlay.onWordClick = this.handleWordClick.bind(this);
  }

  private async handleWordClick(word: string, _rect: DOMRect): Promise<void> {
    if (!this.wordPopup) {
      const { WordPopup } = await import('./word-popup/WordPopup');
      this.wordPopup = new WordPopup();
    }

    const translate = async (text: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'fanyi/instant-translate', payload: { text, sourceLanguage: 'en' } },
          (res) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (res.ok) resolve(res.translation);
            else reject(new Error(res.error));
          },
        );
      });
    };

    const askAi = async (question: string, text: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'fanyi/ai-ask', payload: { video: { videoId: '', title: '' }, question: `请解释这个单词"${word}"的含义和用法`, selectedText: word, context: text } },
          (res) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (res.ok) resolve(res.answer);
            else reject(new Error(res.error));
          },
        );
      });
    };

    this.wordPopup.show(word, translate, askAi);
  }

  async toggleSidePanel(settings: AppSettings): Promise<void> {
    if (!this.sidePanelHost) {
      this.sidePanelHost = new (await import('./side-panel-v2/SidePanelHost')).SidePanelHost(
        this.options.video,
        this.options.player,
        settings,
      );
    }
    this.sidePanelHost.toggle();
  }

  showSidePanel(settings: AppSettings): void {
    void (async () => {
      if (!this.sidePanelHost) {
        this.sidePanelHost = new (await import('./side-panel-v2/SidePanelHost')).SidePanelHost(
          this.options.video, this.options.player, settings,
        );
      }
      this.sidePanelHost.show();
    })();
  }

  hideSidePanel(): void {
    this.sidePanelHost?.hide();
  }

  private updateSidePanelData(cues: BilingualCue[], settings: AppSettings): void {
    if (this.sidePanelHost?.isVisible()) {
      this.sidePanelHost.setData(cues, settings);
    }
  }

  setLoading(message: string): void {
    this.overlay.setLoading(message);
  }

  setError(message: string): void {
    this.overlay.setError(message);
  }

  updateStyle(style: SubtitleStyle): void {
    this.style = style;
    this.overlay.updateStyle(style);
  }

  update(currentTime: number): void {
    this.overlay.update(currentTime);
  }

  setData(cues: BilingualCue[], style: SubtitleStyle): void {
    this.style = style;
    this.renderCues(cues);
  }

  destroy(): void {
    this.overlay.destroy();
    this.sidePanelHost?.destroy();
  }

  private renderCues(cues: BilingualCue[]): void {
    if (!this.style) return;

    this.overlay.setData(cues, this.style);
    // Side panel is updated lazily when visible via setData
  }
}
