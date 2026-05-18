import type { BilingualCue, WordTiming } from '@/domain/models/Cue';
import type { SubtitleStyle } from '@/domain/models/SubtitleStyle';
import { DEFAULT_STYLE } from '@/shared/types';

import { SubtitleToolbar, getToolbarCSS, type SubtitleToolbarCallbacks } from './subtitle-toolbar';

const MIN_DRAG_DISTANCE = 5;

/**
 * 把多个 BilingualCue 按 sentenceId 聚合成完整句子级别的显示单元。
 * 这样中文翻译和英文原文范围一致，不会出现"中文 5 行、英文 1 行"的错位。
 */
interface SentenceDisplay {
  sentenceId: string;
  start: number;
  end: number;
  translation: string;
  fullText: string;
  wordTimings: WordTiming[];
}

export class SubtitleOverlay {
  private readonly host: HTMLDivElement;

  private readonly shadowRootRef: ShadowRoot;

  private readonly statusNode: HTMLDivElement;

  private readonly statusCloseButton: HTMLButtonElement;

  private readonly zhLine: HTMLDivElement;

  private readonly enLine: HTMLDivElement;

  private readonly sheet: CSSStyleSheet | null;

  private readonly fallbackStyleNode: HTMLStyleElement | null;

  /** 句子级显示单元（由 BilingualCue 聚合而来） */
  private sentences: SentenceDisplay[] = [];

  private liveSubtitle: null | {
    translation: string;
    text: string;
    /** 实时模式下"刚被说出来"的词（一般是最后新增的那个），用于跟读高亮。 */
    activeWord?: string;
  } = null;

  private style: SubtitleStyle = DEFAULT_STYLE;

  private playerHeight = 720;

  private readonly wrapper: HTMLDivElement;

  private statusAutoHideTimer: number | null = null;

  // ── 帧级缓存：避免每帧重建 DOM ──
  /** 当前正在显示的句子 id，切换时才重建 DOM */
  private renderedSentenceId = '';
  /** 当前高亮词索引（在句子级 wordTimings 里的下标） */
  private renderedActiveWordIndex = -1;

  public onPositionChange?: (next: {
    leftPercent: number;
    topPercent: number;
  }) => void;

  public onWordClick?: (word: string, rect: DOMRect) => void;
  public onTextSelected?: (text: string, rect: DOMRect) => void;
  public onStyleChange?: (patch: Partial<SubtitleStyle>) => void;
  public onOpenSettings?: () => void;

  private readonly toolbar: SubtitleToolbar;

  constructor(private readonly player: HTMLElement) {
    this.host = document.createElement('div');
    this.host.dataset.fanyiHost = 'true';
    this.host.style.position = 'absolute';
    this.host.style.inset = '0';
    this.host.style.pointerEvents = 'none';
    this.host.style.zIndex = '1000';

    this.ensurePlayerPositioned();
    this.hideNativeCaptions();

    this.shadowRootRef = this.host.attachShadow({ mode: 'closed' });
    this.statusNode = document.createElement('div');
    this.statusCloseButton = document.createElement('button');
    this.zhLine = document.createElement('div');
    this.enLine = document.createElement('div');
    this.sheet = canUseConstructableStylesheets() ? new CSSStyleSheet() : null;
    this.fallbackStyleNode = this.sheet
      ? null
      : document.createElement('style');

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'overlay';
    this.statusNode.className = 'status';
    this.statusCloseButton.className = 'status-close';
    this.statusCloseButton.type = 'button';
    this.statusCloseButton.textContent = '×';
    this.statusCloseButton.title = '关闭提示';
    this.zhLine.className = 'line zh';
    this.enLine.className = 'line en';

    const toolbarCallbacks: SubtitleToolbarCallbacks = {
      onStyleChange: (patch) => this.onStyleChange?.(patch),
      onOpenSettings: () => this.onOpenSettings?.(),
    };
    this.toolbar = new SubtitleToolbar(toolbarCallbacks);

    this.wrapper.append(
      this.toolbar.el,
      this.statusNode,
      this.statusCloseButton,
      this.zhLine,
      this.enLine,
    );
    if (this.sheet) {
      this.shadowRootRef.adoptedStyleSheets = [this.sheet];
    } else if (this.fallbackStyleNode) {
      this.shadowRootRef.append(this.fallbackStyleNode);
    }
    this.shadowRootRef.append(this.wrapper);
    this.player.append(this.host);

    this.installDragHandlers();
    this.installWordClickHandlers();
    this.statusCloseButton.addEventListener('click', () => this.hideStatus());
    this.applyStyle(this.style);
    new ResizeObserver(() => {
      this.ensurePlayerPositioned();
      this.updatePlayerMetrics();
    }).observe(this.player);
    this.updatePlayerMetrics();
  }

  setLoading(message = 'Fanyi 正在生成双语字幕...'): void {
    this.clearStatusAutoHide();
    this.statusNode.textContent = message;
    this.statusNode.style.display = 'block';
    this.statusCloseButton.style.display = 'none';
    this.zhLine.textContent = '';
    this.enLine.textContent = '';
    this.invalidateRenderCache();
  }

  setError(message: string, autoHideMs = 15000): void {
    this.clearStatusAutoHide();
    this.statusNode.textContent = message;
    this.statusNode.style.display = 'block';
    this.statusCloseButton.style.display = 'grid';
    this.zhLine.textContent = '';
    this.enLine.textContent = '';
    this.invalidateRenderCache();

    if (autoHideMs > 0) {
      this.statusAutoHideTimer = window.setTimeout(() => {
        this.hideStatus();
      }, autoHideMs);
    }
  }

  setData(cues: BilingualCue[], style: SubtitleStyle): void {
    this.sentences = buildSentenceDisplays(cues);
    this.liveSubtitle = null;
    this.applyStyle(style);
    this.hideStatus();
    this.invalidateRenderCache();
  }

  setLiveSubtitle(
    value: {
      translation: string;
      text: string;
      activeWord?: string;
    },
    style: SubtitleStyle,
  ): void {
    this.sentences = [];
    this.liveSubtitle = value;
    this.applyStyle(style);
    this.hideStatus();
    this.zhLine.textContent = this.shouldShowChinese() ? value.translation : '';
    if (this.shouldShowEnglish()) {
      this.renderLiveEnglish(value.text, value.activeWord);
    } else {
      this.enLine.textContent = '';
    }
    this.syncLineVisibility();
    this.invalidateRenderCache();
  }

  updateStyle(style: SubtitleStyle): void {
    this.applyStyle(style);
    this.invalidateRenderCache();
  }

  update(currentTime: number): void {
    if (this.liveSubtitle) {
      return;
    }

    const sentence = this.findSentence(currentTime);

    if (!sentence) {
      if (this.renderedSentenceId !== '') {
        this.zhLine.textContent = '';
        this.enLine.textContent = '';
        this.syncLineVisibility();
        this.renderedSentenceId = '';
        this.renderedActiveWordIndex = -1;
      }
      return;
    }

    // ── 同一句：只更新高亮词 ──
    if (sentence.sentenceId === this.renderedSentenceId) {
      if (this.shouldShowEnglish()) {
        this.updateActiveWord(sentence, currentTime);
      }
      return;
    }

    // ── 换句：重建 DOM ──
    this.renderedSentenceId = sentence.sentenceId;
    this.renderedActiveWordIndex = -1;
    this.zhLine.textContent = this.shouldShowChinese()
      ? sentence.translation
      : '';
    if (this.shouldShowEnglish()) {
      this.renderEnglishSentence(sentence, currentTime);
    } else {
      this.enLine.textContent = '';
    }
    this.syncLineVisibility();
  }

  destroy(): void {
    this.clearStatusAutoHide();
    this.host.remove();
    this.restoreNativeCaptions();
  }

  // ── 隐藏 / 恢复 YouTube 原生字幕 ──

  private nativeCaptionStyle: HTMLStyleElement | null = null;

  /**
   * 注入一段 CSS 把 YouTube 自带的字幕层隐藏掉，避免跟我们的双语字幕叠在一起。
   * 用 <style> 标签而不是直接 display:none，这样卸载时只需要移除标签就能恢复。
   */
  private hideNativeCaptions(): void {
    if (this.nativeCaptionStyle) return;
    const style = document.createElement('style');
    style.dataset.fanyiHideCaption = 'true';
    style.textContent = `
      .caption-window,
      .ytp-caption-window-container {
        display: none !important;
      }
    `;
    document.head.append(style);
    this.nativeCaptionStyle = style;
  }

  private restoreNativeCaptions(): void {
    this.nativeCaptionStyle?.remove();
    this.nativeCaptionStyle = null;
  }

  // ── 渲染缓存管理 ──

  private invalidateRenderCache(): void {
    this.renderedSentenceId = '';
    this.renderedActiveWordIndex = -1;
  }

  // ── 二分查找当前句子 ──

  private findSentence(currentTime: number): SentenceDisplay | undefined {
    const items = this.sentences;
    if (items.length === 0) return undefined;

    let low = 0;
    let high = items.length - 1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (items[mid].end < currentTime) {
        low = mid + 1;
      } else if (items[mid].start > currentTime) {
        high = mid - 1;
      } else {
        return items[mid];
      }
    }

    return undefined;
  }

  // ── 只更新高亮词（不重建 DOM） ──

  private updateActiveWord(
    sentence: SentenceDisplay,
    currentTime: number,
  ): void {
    if (sentence.wordTimings.length === 0) return;

    const activeIndex = findActiveWordIndex(sentence.wordTimings, currentTime);

    if (activeIndex === this.renderedActiveWordIndex) return;

    const spans = this.enLine.querySelectorAll<HTMLSpanElement>('span');
    if (
      this.renderedActiveWordIndex >= 0 &&
      this.renderedActiveWordIndex < spans.length
    ) {
      spans[this.renderedActiveWordIndex].className = 'word-clickable';
    }
    if (activeIndex >= 0 && activeIndex < spans.length) {
      spans[activeIndex].className = 'word-clickable active-word';
    }
    this.renderedActiveWordIndex = activeIndex;
  }

  // ── 渲染句子级英文行 ──

  private renderEnglishSentence(
    sentence: SentenceDisplay,
    currentTime: number,
  ): void {
    const activeIndex = findActiveWordIndex(sentence.wordTimings, currentTime);
    this.renderedActiveWordIndex = activeIndex;

    this.enLine.innerHTML = '';

    if (sentence.wordTimings.length === 0) {
      this.enLine.textContent = sentence.fullText;
      return;
    }

    sentence.wordTimings.forEach((word, index) => {
      const span = document.createElement('span');
      span.textContent = word.word;
      span.className = 'word-clickable';
      if (index === activeIndex) {
        span.classList.add('active-word');
      }
      this.enLine.append(span);
      if (index < sentence.wordTimings.length - 1) {
        this.enLine.append(document.createTextNode(' '));
      }
    });
  }

  // ── 拖拽 ──

  /**
   * 拖拽现在只通过工具栏的 drag-handle 按钮触发，不再在整个 overlay 上启用。
   */
  private installDragHandlers(): void {
    let dragging = false;
    let hasMoved = false;
    let pointerId = -1;
    let startClientX = 0;
    let startClientY = 0;
    let startCenterX = 0;
    let startCenterY = 0;

    const handle = this.toolbar.dragHandle;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      this.toolbar.closeAllDropdowns();
      dragging = true;
      hasMoved = false;
      pointerId = event.pointerId;
      const rect = this.wrapper.getBoundingClientRect();
      startCenterX = rect.left + rect.width / 2;
      startCenterY = rect.top + rect.height / 2;
      startClientX = event.clientX;
      startClientY = event.clientY;
      handle.setPointerCapture(pointerId);
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging || event.pointerId !== pointerId) return;

      const dx = event.clientX - startClientX;
      const dy = event.clientY - startClientY;

      if (!hasMoved && Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_DISTANCE) return;

      if (!hasMoved) {
        hasMoved = true;
        this.wrapper.classList.add('dragging');
      }

      const playerRect = this.player.getBoundingClientRect();
      const centerX = startCenterX + dx;
      const centerY = startCenterY + dy;
      const padding = 4;
      const clampedX = Math.min(
        Math.max(centerX, playerRect.left + padding),
        playerRect.right - padding,
      );
      const clampedY = Math.min(
        Math.max(centerY, playerRect.top + padding),
        playerRect.bottom - padding,
      );

      this.wrapper.style.left = `${clampedX - playerRect.left}px`;
      this.wrapper.style.top = `${clampedY - playerRect.top}px`;
      this.wrapper.style.bottom = 'auto';
      this.wrapper.style.transform = 'translate(-50%, -50%)';
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      this.wrapper.classList.remove('dragging');
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }

      if (!hasMoved) return;

      const playerRect = this.player.getBoundingClientRect();
      if (playerRect.width === 0 || playerRect.height === 0) return;

      const leftPx = parseFloat(this.wrapper.style.left || '0');
      const topPx = parseFloat(this.wrapper.style.top || '0');
      const leftPercent = leftPx / playerRect.width;
      const topPercent = topPx / playerRect.height;

      this.wrapper.style.left = '';
      this.wrapper.style.top = '';
      this.wrapper.style.bottom = '';
      this.wrapper.style.transform = '';

      this.style = {
        ...this.style,
        customPosition: { leftPercent, topPercent },
      };
      this.updatePlayerMetrics();
      this.onPositionChange?.({ leftPercent, topPercent });
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
  }

  private installWordClickHandlers(): void {
    this.enLine.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'SPAN' && target.classList.contains('word-clickable')) {
        const word = target.textContent?.trim();
        if (word && this.onWordClick) {
          this.onWordClick(word, target.getBoundingClientRect());
        }
      }
    });

    this.shadowRootRef.addEventListener('mouseup', () => {
      const sel = (this.shadowRootRef as unknown as { getSelection?: () => Selection | null }).getSelection?.() ?? document.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text || text.length < 2) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      this.onTextSelected?.(text, rect);
    });
  }

  /**
   * 实时模式下渲染英文行：把当前 CC 文本切成 token，把 activeWord 标红。
   */
  private renderLiveEnglish(
    text: string,
    activeWord: string | undefined,
  ): void {
    this.enLine.innerHTML = '';
    if (!text) return;

    const trimmedActive = activeWord?.trim() ?? '';
    const tokens = text.split(/\s+/).filter(Boolean);

    tokens.forEach((token, index) => {
      const span = document.createElement('span');
      span.textContent = token;
      span.className = 'word-clickable';
      this.enLine.append(span);
      if (index < tokens.length - 1) {
        this.enLine.append(document.createTextNode(' '));
      }
    });

    if (trimmedActive) {
      const allSpans = [
        ...this.enLine.querySelectorAll<HTMLSpanElement>('span'),
      ];
      for (let i = allSpans.length - 1; i >= 0; i -= 1) {
        if (allSpans[i].textContent === trimmedActive) {
          allSpans[i].className = 'active-word';
          break;
        }
      }
    }
  }

  /**
   * 确保 player 有定位上下文。YouTube 在影院/全屏切换时可能会动态修改 player 的
   * position 属性，导致 host（position:absolute）的包含块变成更上层元素，
   * 字幕就会跑到页面左上角。每次 ResizeObserver 触发都检查一遍。
   */
  private ensurePlayerPositioned(): void {
    if (getComputedStyle(this.player).position === 'static') {
      this.player.style.position = 'relative';
    }
  }

  private applyStyle(style: SubtitleStyle): void {
    if (!style.customPosition && this.style.customPosition) {
      this.style = { ...style, customPosition: this.style.customPosition };
    } else {
      this.style = style;
    }
    this.toolbar.updateStyle(this.style);
    this.syncLineOrder();
    this.updatePlayerMetrics();
  }

  private updatePlayerMetrics(): void {
    this.playerHeight = Math.max(this.player.clientHeight, 320);
    const playerWidth = Math.max(this.player.clientWidth, 480);
    const referenceHeight = Math.min(
      this.playerHeight,
      (playerWidth * 9) / 16,
      760,
    );
    const zhSize =
      (referenceHeight * 0.034 * this.style.zhFontSizePercent) / 100;
    const enSize =
      (referenceHeight * 0.034 * 0.72 * this.style.enFontSizePercent) / 100;
    const maxWidth = clamp(this.style.maxWidthPercent, 45, 96);
    const strokeWidth = clamp(this.style.strokeWidth, 0, 3);
    const shadowAlpha = clamp(this.style.shadowStrength, 0, 100) / 100;
    const lineGap = (zhSize * clamp(this.style.lineGapPercent, 0, 60)) / 100;
    const lineHeightScale = clamp(this.style.lineHeightPercent, 80, 130) / 100;
    const zhLineHeight = (1.32 * lineHeightScale).toFixed(2);
    const enLineHeight = (1.42 * lineHeightScale).toFixed(2);
    const backgroundColor = colorWithOpacity(
      this.style.backgroundColor,
      clamp(this.style.backgroundOpacity, 0, 85) / 100,
    );

    const custom = this.style.customPosition;
    const positionCss = custom
      ? `
        left: ${(custom.leftPercent * 100).toFixed(3)}%;
        top: ${(custom.topPercent * 100).toFixed(3)}%;
        bottom: auto;
        transform: translate(-50%, -50%);
      `
      : `
        left: 50%;
        bottom: ${this.style.bottomOffsetPercent}%;
        transform: translateX(-50%);
      `;

    const css = `
      :host {
        all: initial;
      }

      .overlay {
        position: absolute;
        ${positionCss}
        right: auto;
        width: fit-content;
        min-width: 10%;
        max-width: ${maxWidth}%;
        padding: ${this.style.backgroundEnabled ? `${zhSize * 0.34}px ${zhSize * 0.52}px` : '0'};
        border-radius: ${this.style.backgroundEnabled ? `${Math.max(8, zhSize * 0.28)}px` : '0'};
        background: ${this.style.backgroundEnabled ? backgroundColor : 'transparent'};
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        pointer-events: auto;
        cursor: default;
        user-select: none;
        touch-action: none;
      }

      .overlay.dragging {
        cursor: grabbing;
        opacity: 0.92;
      }

      .status {
        display: none;
        color: white;
        font: 600 14px/1.4 system-ui, sans-serif;
        margin-bottom: 10px;
        white-space: pre-wrap;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      }

      .status-close {
        display: none;
        position: absolute;
        top: -36px;
        right: -8px;
        width: 28px;
        height: 28px;
        place-items: center;
        border: 0;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.92);
        color: white;
        font: 700 18px/1 system-ui, sans-serif;
        cursor: pointer;
        pointer-events: auto;
      }

      .line {
        width: 100%;
        margin-top: 0;
        letter-spacing: 0;
        user-select: text;
        cursor: text;
      }

      .line.lower-line {
        margin-top: ${lineGap}px;
      }

      .zh {
        color: ${this.style.zhColor};
        font-family: ${this.style.zhFontFamily};
        font-size: ${zhSize}px;
        font-weight: ${this.style.zhFontWeight};
        line-height: ${zhLineHeight};
        -webkit-text-stroke: ${strokeWidth}px rgba(0, 0, 0, 0.85);
        text-shadow:
          0 1px 2px rgba(0, 0, 0, ${0.45 * shadowAlpha}),
          0 0 8px rgba(0, 0, 0, ${0.4 * shadowAlpha});
        paint-order: stroke fill;
      }

      .en {
        color: ${this.style.enColor};
        font-family: ${this.style.enFontFamily};
        font-size: ${enSize}px;
        font-weight: ${this.style.enFontWeight};
        line-height: ${enLineHeight};
        text-shadow: 0 1px 2px rgba(0, 0, 0, ${0.58 * shadowAlpha});
      }

      .active-word {
        color: ${this.style.highlightColor};
        font-weight: 700;
        text-decoration: underline;
        text-decoration-color: ${this.style.highlightColor};
        text-decoration-thickness: 2.5px;
        text-underline-offset: 4px;
        text-decoration-skip-ink: none;
        transition:
          color 80ms ease-out,
          text-decoration-color 80ms ease-out;
      }

      ${getToolbarCSS()}
    `;

    if (this.sheet) {
      this.sheet.replaceSync(css);
    } else if (this.fallbackStyleNode) {
      this.fallbackStyleNode.textContent = css;
    }
  }

  private syncLineOrder(): void {
    const enFirst = this.style.lineOrder === 'en-first';
    const showBoth = this.shouldShowChinese() && this.shouldShowEnglish();
    this.statusNode.style.order = '0';
    this.statusCloseButton.style.order = '0';
    this.enLine.style.order = enFirst ? '1' : '2';
    this.zhLine.style.order = enFirst ? '2' : '1';
    this.enLine.classList.toggle('lower-line', showBoth && !enFirst);
    this.zhLine.classList.toggle('lower-line', showBoth && enFirst);
    this.syncLineVisibility();
  }

  private shouldShowChinese(): boolean {
    return this.style.showChinese !== false;
  }

  private shouldShowEnglish(): boolean {
    return this.style.showEnglish !== false;
  }

  private syncLineVisibility(): void {
    this.zhLine.style.display = this.shouldShowChinese() ? 'block' : 'none';
    this.enLine.style.display = this.shouldShowEnglish() ? 'block' : 'none';
  }

  private hideStatus(): void {
    this.clearStatusAutoHide();
    this.statusNode.style.display = 'none';
    this.statusNode.textContent = '';
    this.statusCloseButton.style.display = 'none';
  }

  private clearStatusAutoHide(): void {
    if (this.statusAutoHideTimer !== null) {
      window.clearTimeout(this.statusAutoHideTimer);
      this.statusAutoHideTimer = null;
    }
  }
}

// ── helpers ──

function canUseConstructableStylesheets(): boolean {
  return (
    typeof CSSStyleSheet !== 'undefined' &&
    'replaceSync' in CSSStyleSheet.prototype &&
    'adoptedStyleSheets' in Document.prototype
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function colorWithOpacity(hex: string, opacity: number): string {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    return `rgba(0, 0, 0, ${opacity})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

/**
 * 把 BilingualCue 按 sentenceId 聚合成句子级显示单元。
 * 同一个 sentenceId 的 cue 合并：
 *   - fullText = 所有 cue 的文本拼接
 *   - wordTimings = 所有 cue 的 wordTimings 首尾相连
 *   - start/end = 第一个 cue 的 start ～ 最后一个 cue 的 end
 *   - translation = 共享的句子翻译（取第一个 cue 的即可，都是一样的）
 */
/**
 * 两句之间如果间隔不超过这个秒数，就把前一句的 end 延伸到后一句的 start，
 * 让字幕无缝衔接、不出现"上句消失 → 空白 → 下句出现"的断层。
 */
const MAX_BRIDGE_GAP_SEC = 3;

function buildSentenceDisplays(cues: BilingualCue[]): SentenceDisplay[] {
  if (cues.length === 0) return [];

  const result: SentenceDisplay[] = [];
  let current: SentenceDisplay | null = null;

  for (const cue of cues) {
    if (current && current.sentenceId === cue.sentenceId) {
      current.end = cue.end;
      current.wordTimings.push(...cue.wordTimings);
      if (cue.text.trim()) {
        current.fullText += ' ' + cue.text.trim();
      }
    } else {
      current = {
        sentenceId: cue.sentenceId,
        start: cue.start,
        end: cue.end,
        translation: cue.translation,
        fullText: cue.text.trim(),
        wordTimings: [...cue.wordTimings],
      };
      result.push(current);
    }
  }

  // 把相邻句子间的小间隙填上：前一句的 end 延伸到后一句的 start，
  // 这样 findSentence() 不会在间隙里返回 undefined 导致字幕断层。
  for (let i = 0; i < result.length - 1; i++) {
    const gap = result[i + 1].start - result[i].end;
    if (gap > 0 && gap <= MAX_BRIDGE_GAP_SEC) {
      result[i].end = result[i + 1].start;
    }
  }

  return result;
}

function findActiveWordIndex(
  wordTimings: WordTiming[],
  currentTime: number,
): number {
  for (let i = 0; i < wordTimings.length; i++) {
    if (
      currentTime >= wordTimings[i].start &&
      currentTime <= wordTimings[i].end
    ) {
      return i;
    }
  }
  return -1;
}
