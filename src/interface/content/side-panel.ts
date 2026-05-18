import type { BilingualCue } from '@/domain/models/Cue';

export interface LiveTranscriptEntry {
  start: number;
  text: string;
  translation: string;
}

export class SidePanel {
  private readonly toggle: HTMLButtonElement;

  private readonly panel: HTMLDivElement;

  private readonly list: HTMLDivElement;

  /** 实时模式下累积的英文段，用来去重（同一句英文只追加一次润色版） */
  private liveSeenEnglish = new Set<string>();

  constructor(private readonly video: HTMLVideoElement) {
    this.toggle = document.createElement('button');
    this.panel = document.createElement('div');
    this.list = document.createElement('div');

    this.toggle.textContent = 'Fanyi';
    this.toggle.style.cssText = `
      position: fixed;
      top: 96px;
      right: 0;
      z-index: 2147483646;
      border: none;
      background: #0f172a;
      color: white;
      border-radius: 16px 0 0 16px;
      padding: 10px 14px;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    `;

    this.panel.style.cssText = `
      position: fixed;
      top: 0;
      right: -360px;
      width: 360px;
      height: 100vh;
      z-index: 2147483645;
      background: rgba(15, 23, 42, 0.96);
      color: white;
      backdrop-filter: blur(18px);
      transition: right 180ms ease;
      box-shadow: -10px 0 32px rgba(0,0,0,0.24);
      display: flex;
      flex-direction: column;
    `;

    const header = document.createElement('div');
    header.textContent = 'Bilingual Script';
    header.style.cssText = `
      padding: 20px 20px 12px;
      font: 700 18px/1.2 system-ui, sans-serif;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    `;

    this.list.style.cssText = `
      overflow: auto;
      padding: 12px 16px 20px;
      display: grid;
      gap: 10px;
    `;

    this.panel.append(header, this.list);
    this.toggle.addEventListener('click', () => {
      this.panel.style.right = this.panel.style.right === '0px' ? '-360px' : '0px';
    });

    document.body.append(this.toggle, this.panel);
  }

  setData(cues: BilingualCue[]): void {
    this.list.innerHTML = '';
    this.liveSeenEnglish.clear();

    if (!Array.isArray(cues)) {
      const hint = document.createElement('div');
      hint.textContent = 'Fanyi: 字幕列表结果结构异常。';
      hint.style.cssText = 'color:#fca5a5;font-size:13px;line-height:1.5;';
      this.list.append(hint);
      return;
    }

    cues.forEach((cue) => {
      this.list.append(this.buildEntry(cue));
    });
  }

  /**
   * 实时模式下增量追加一条已润色的双语条目。
   * 同一句英文只会被追加一次，避免 LLM 对同一帧滚动字幕重复润色刷屏。
   */
  appendLiveEntry(entry: LiveTranscriptEntry): void {
    const key = entry.text.trim();
    if (!key || this.liveSeenEnglish.has(key)) return;
    this.liveSeenEnglish.add(key);

    this.list.append(
      this.buildEntry({
        id: `live-${Date.now()}`,
        start: entry.start,
        end: entry.start,
        text: entry.text,
        translation: entry.translation,
        sentenceId: 'live',
        wordTimings: [],
      }),
    );

    // 自动滚到最新条目（用户不用手动追）
    this.list.scrollTop = this.list.scrollHeight;
  }

  private buildEntry(cue: BilingualCue): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = `
      text-align: left;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: white;
      border-radius: 14px;
      padding: 12px;
      cursor: pointer;
    `;

    button.innerHTML = `
      <div style="font-size:12px;color:#94a3b8;margin-bottom:6px;">${formatTime(cue.start)}</div>
      <div style="font-size:15px;font-weight:700;line-height:1.45;margin-bottom:6px;">${escapeHtml(cue.translation)}</div>
      <div style="font-size:13px;color:#cbd5e1;line-height:1.45;">${escapeHtml(cue.text)}</div>
    `;

    button.addEventListener('click', () => {
      this.video.currentTime = cue.start;
    });

    return button;
  }

  destroy(): void {
    this.toggle.remove();
    this.panel.remove();
  }
}

function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
