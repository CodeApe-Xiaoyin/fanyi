import type { SubtitleStyle } from '@/domain/models/SubtitleStyle';
import { SUBTITLE_STYLE_PRESETS } from '@/shared/subtitle-style-presets';

import {
  ToolbarDropdown,
  createCheckbox,
  createColorChips,
  createSelect,
  createSlider,
} from './toolbar-dropdown';

export interface SubtitleToolbarCallbacks {
  onStyleChange: (patch: Partial<SubtitleStyle>) => void;
  onOpenSettings: () => void;
}

const BG_COLOR_PRESETS = [
  { color: '#000000', label: '纯黑' },
  { color: '#1a1a2e', label: '墨灰' },
  { color: '#0d1b2a', label: '深蓝' },
  { color: '#2d2d2d', label: '炭黑' },
];

export class SubtitleToolbar {
  readonly el: HTMLDivElement;
  readonly dragHandle: HTMLButtonElement;

  private style: SubtitleStyle | null = null;
  private activeDropdown: ToolbarDropdown | null = null;
  private dropdowns: ToolbarDropdown[] = [];
  private callbacks: SubtitleToolbarCallbacks;

  constructor(callbacks: SubtitleToolbarCallbacks) {
    this.callbacks = callbacks;
    this.el = document.createElement('div');
    this.el.className = 'toolbar';

    const langBtn = this.createButton('语言显示');
    const fontBtn = this.createButton('字体大小');
    const themeBtn = this.createButton('主题样式');
    const settingsBtn = this.createButton('设置');
    this.dragHandle = document.createElement('button');
    this.dragHandle.type = 'button';
    this.dragHandle.className = 'toolbar-btn drag-handle';
    this.dragHandle.innerHTML = '<span class="drag-icon">⠿</span> 拖动';

    const langDropdown = this.buildLanguageDropdown();
    const fontDropdown = this.buildFontDropdown();
    const themeDropdown = this.buildThemeDropdown();

    this.dropdowns = [langDropdown, fontDropdown, themeDropdown];

    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown(langDropdown, langBtn);
    });
    fontBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown(fontDropdown, fontBtn);
    });
    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown(themeDropdown, themeBtn);
    });
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      callbacks.onOpenSettings();
    });

    this.el.append(langBtn, fontBtn, themeBtn, settingsBtn, this.dragHandle);
    for (const dd of this.dropdowns) {
      this.el.append(dd.el);
    }
  }

  updateStyle(style: SubtitleStyle): void {
    this.style = style;
  }

  closeAllDropdowns(): void {
    for (const dd of this.dropdowns) dd.hide();
    this.activeDropdown = null;
  }

  private createButton(text: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toolbar-btn';
    btn.textContent = text;
    return btn;
  }

  private toggleDropdown(dropdown: ToolbarDropdown, anchor: HTMLElement): void {
    if (this.activeDropdown === dropdown && dropdown.isVisible) {
      dropdown.hide();
      this.activeDropdown = null;
      return;
    }
    this.closeAllDropdowns();
    this.rebuildDropdownContent(dropdown);
    const anchorRect = anchor.getBoundingClientRect();
    const containerRect = this.el.getBoundingClientRect();
    dropdown.toggle(anchorRect, containerRect);
    this.activeDropdown = dropdown;
  }

  private rebuildDropdownContent(dropdown: ToolbarDropdown): void {
    if (!this.style) return;
    const idx = this.dropdowns.indexOf(dropdown);
    if (idx === 0) this.populateLanguageDropdown(dropdown);
    else if (idx === 1) this.populateFontDropdown(dropdown);
    else if (idx === 2) this.populateThemeDropdown(dropdown);
  }

  private buildLanguageDropdown(): ToolbarDropdown {
    const dd = new ToolbarDropdown();
    return dd;
  }

  private buildFontDropdown(): ToolbarDropdown {
    return new ToolbarDropdown();
  }

  private buildThemeDropdown(): ToolbarDropdown {
    return new ToolbarDropdown();
  }

  private populateLanguageDropdown(dd: ToolbarDropdown): void {
    if (!this.style) return;
    const s = this.style;
    const nodes: Node[] = [];

    nodes.push(createCheckbox('显示中文', s.showChinese, (v) => {
      this.callbacks.onStyleChange({ showChinese: v });
    }));
    nodes.push(createCheckbox('显示英文', s.showEnglish, (v) => {
      this.callbacks.onStyleChange({ showEnglish: v });
    }));
    nodes.push(createSelect(
      '行序',
      [
        { value: 'zh-first', label: '中文在上' },
        { value: 'en-first', label: '英文在上' },
      ],
      s.lineOrder,
      (v) => this.callbacks.onStyleChange({ lineOrder: v as SubtitleStyle['lineOrder'] }),
    ));

    dd.setContent(nodes);
  }

  private populateFontDropdown(dd: ToolbarDropdown): void {
    if (!this.style) return;
    const s = this.style;
    const nodes: Node[] = [];

    nodes.push(createSlider('中文字号', s.zhFontSizePercent, 80, 140, (v) => {
      this.callbacks.onStyleChange({ zhFontSizePercent: v });
    }));
    nodes.push(createSlider('英文字号', s.enFontSizePercent, 80, 140, (v) => {
      this.callbacks.onStyleChange({ enFontSizePercent: v });
    }));
    nodes.push(createSlider('行间距', s.lineGapPercent, 0, 60, (v) => {
      this.callbacks.onStyleChange({ lineGapPercent: v });
    }));
    nodes.push(createSlider('底部偏移', s.bottomOffsetPercent, 6, 20, (v) => {
      this.callbacks.onStyleChange({ bottomOffsetPercent: v });
    }));

    dd.setContent(nodes);
  }

  private populateThemeDropdown(dd: ToolbarDropdown): void {
    if (!this.style) return;
    const s = this.style;
    const nodes: Node[] = [];

    const presetsLabel = document.createElement('div');
    presetsLabel.className = 'dropdown-section-label';
    presetsLabel.textContent = '样式预设';
    nodes.push(presetsLabel);

    const presetsGrid = document.createElement('div');
    presetsGrid.className = 'dropdown-presets-grid';
    for (const preset of SUBTITLE_STYLE_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-chip';
      btn.textContent = preset.name;
      btn.addEventListener('click', () => {
        this.callbacks.onStyleChange(preset.style);
      });
      presetsGrid.append(btn);
    }
    nodes.push(presetsGrid);

    const bgLabel = document.createElement('div');
    bgLabel.className = 'dropdown-section-label';
    bgLabel.textContent = '字幕背景';
    nodes.push(bgLabel);

    nodes.push(createCheckbox('启用背景', s.backgroundEnabled, (v) => {
      this.callbacks.onStyleChange({ backgroundEnabled: v });
    }));
    nodes.push(createColorChips(BG_COLOR_PRESETS, s.backgroundColor, (color) => {
      this.callbacks.onStyleChange({ backgroundColor: color, backgroundEnabled: true });
    }));
    nodes.push(createSlider('不透明度', s.backgroundOpacity, 0, 85, (v) => {
      this.callbacks.onStyleChange({ backgroundOpacity: v });
    }));

    dd.setContent(nodes);
  }
}

export function getToolbarCSS(): string {
  return `
    .toolbar {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 4px 8px;
      margin-bottom: 6px;
      border-radius: 999px;
      background: rgba(60, 60, 60, 0.88);
      backdrop-filter: blur(8px);
      opacity: 0;
      transition: opacity 180ms ease;
      pointer-events: auto;
      order: -1;
      white-space: nowrap;
    }

    .overlay:hover .toolbar,
    .toolbar:hover {
      opacity: 1;
    }

    .toolbar-btn {
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.88);
      font: 500 12px/1 system-ui, sans-serif;
      padding: 5px 10px;
      border-radius: 999px;
      cursor: pointer;
      white-space: nowrap;
      user-select: none;
    }

    .toolbar-btn:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }

    .drag-handle {
      cursor: grab;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .drag-icon {
      font-size: 14px;
      line-height: 1;
    }

    .toolbar-dropdown {
      position: absolute;
      bottom: calc(100% + 8px);
      display: none;
      flex-direction: column;
      gap: 8px;
      min-width: 200px;
      max-width: 280px;
      padding: 12px;
      border-radius: 12px;
      background: rgba(30, 30, 30, 0.96);
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      color: white;
      font: 400 13px/1.5 system-ui, sans-serif;
      z-index: 10;
      pointer-events: auto;
    }

    .dropdown-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      padding: 4px 0;
    }

    .dropdown-checkbox input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #5b8def;
      cursor: pointer;
    }

    .dropdown-slider {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .dropdown-slider-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }

    .dropdown-slider input[type="range"] {
      width: 100%;
      height: 4px;
      appearance: none;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }

    .dropdown-slider input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #5b8def;
      cursor: pointer;
    }

    .dropdown-select {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 0;
    }

    .dropdown-select select {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 12px;
      cursor: pointer;
    }

    .dropdown-select select option {
      background: #2d2d2d;
      color: white;
    }

    .dropdown-color-chips {
      display: flex;
      gap: 6px;
      padding: 4px 0;
    }

    .color-chip {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.2);
      background: var(--chip-color);
      cursor: pointer;
      padding: 0;
    }

    .color-chip.active {
      border-color: #5b8def;
      box-shadow: 0 0 0 2px rgba(91, 141, 239, 0.4);
    }

    .dropdown-section-label {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding-top: 4px;
    }

    .dropdown-presets-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .preset-chip {
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.85);
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 999px;
      cursor: pointer;
    }

    .preset-chip:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .en span.word-clickable {
      cursor: pointer;
      transition: text-decoration-color 120ms ease;
    }

    .en span.word-clickable:hover {
      text-decoration: underline;
      text-decoration-color: rgba(100, 160, 255, 0.7);
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
    }
  `;
}
