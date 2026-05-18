import { speak, stopSpeaking } from './pronunciation';

const POPUP_CSS = `
:host{all:initial}
.popup{
  position:fixed;z-index:2147483646;
  min-width:180px;max-width:320px;
  background:rgba(20,24,38,0.96);
  color:#e2e8f0;
  border:1px solid rgba(255,255,255,0.1);
  border-radius:12px;
  padding:14px;
  font:400 13px/1.5 system-ui,sans-serif;
  box-shadow:0 12px 40px rgba(0,0,0,0.5);
  backdrop-filter:blur(12px);
  display:flex;flex-direction:column;gap:10px;
}
.popup-word{font-size:15px;font-weight:700;color:#fff}
.popup-translation{font-size:14px;color:#93b4f5;font-weight:600}
.popup-loading{font-size:12px;color:#64748b}
.popup-btns{display:flex;gap:6px;flex-wrap:wrap}
.popup-btn{
  padding:5px 12px;border:none;border-radius:6px;
  background:rgba(255,255,255,0.08);color:#e2e8f0;
  font-size:12px;cursor:pointer;
  display:flex;align-items:center;gap:4px;
}
.popup-btn:hover{background:rgba(255,255,255,0.16)}
.popup-btn.primary{background:#5b8def;color:#fff;font-weight:600}
.popup-answer{
  max-height:200px;overflow-y:auto;
  background:rgba(255,255,255,0.04);
  border-radius:8px;padding:10px;
  font-size:12px;line-height:1.6;white-space:pre-wrap;
}
.popup-close{
  position:absolute;top:6px;right:8px;
  border:none;background:transparent;color:#94a3b8;
  font-size:16px;cursor:pointer;line-height:1;
}
`;

export class WordPopup {
  private host: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;

  show(word: string, translate: (t: string) => Promise<string>, askAi: (q: string, t: string) => Promise<string>): void {
    this.destroy();
    this.host = document.createElement('div');
    this.shadowRoot = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = POPUP_CSS;
    this.shadowRoot.append(style);

    const popup = document.createElement('div');
    popup.className = 'popup';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'popup-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => this.destroy());

    const wordEl = document.createElement('div');
    wordEl.className = 'popup-word';
    wordEl.textContent = word;

    const tlEl = document.createElement('div');
    tlEl.className = 'popup-loading';
    tlEl.textContent = '翻译中...';

    const btns = document.createElement('div');
    btns.className = 'popup-btns';

    const speakBtn = document.createElement('button');
    speakBtn.className = 'popup-btn';
    speakBtn.innerHTML = '🔊 发音';
    speakBtn.addEventListener('click', () => speak(word, 'en-US'));

    const askBtn = document.createElement('button');
    askBtn.className = 'popup-btn primary';
    askBtn.textContent = 'ASK AI';

    btns.append(speakBtn, askBtn);

    const answerEl = document.createElement('div');
    answerEl.style.display = 'none';

    popup.append(closeBtn, wordEl, tlEl, btns, answerEl);
    this.shadowRoot.append(popup);
    document.body.append(this.host);

    this.positionNear();

    translate(word).then((translation) => {
      tlEl.className = 'popup-translation';
      tlEl.textContent = translation;
    }).catch(() => {
      tlEl.textContent = '翻译失败';
    });

    let answerShown = false;
    askBtn.addEventListener('click', () => {
      if (answerShown) {
        answerEl.style.display = 'none';
        answerShown = false;
        return;
      }
      answerEl.style.display = 'block';
      answerEl.innerHTML = '<div class="popup-loading">AI 思考中...</div>';
      askAi(word, '').then((answer) => {
        answerEl.innerHTML = `<div class="popup-answer">${escapeHtml(answer)}</div>`;
      }).catch((err) => {
        answerEl.innerHTML = `<div style="color:#fca5a5;font-size:12px">${escapeHtml(err.message)}</div>`;
      });
      answerShown = true;
    });
  }

  destroy(): void {
    stopSpeaking();
    this.host?.remove();
    this.host = null;
    this.shadowRoot = null;
  }

  private positionNear(): void {
    if (!this.host) return;
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 0) {
        this.host.style.left = `${Math.max(10, rect.left + rect.width / 2 - 150)}px`;
        this.host.style.top = `${rect.bottom + 8}px`;
        return;
      }
    }
    this.host.style.left = '50%';
    this.host.style.top = '30%';
    this.host.style.transform = 'translate(-50%, -50%)';
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
