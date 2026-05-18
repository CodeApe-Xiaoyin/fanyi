import type { SubtitleStyle } from '@/shared/types';

interface Props {
  style: SubtitleStyle;
}

const BG_AGENT = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
const COLOR_BG = 'linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #0d1b2a 100%)';

function toRgba(hex: string, opacity: number): string {
  const n = hex.trim().replace(/^#/, '');
  if (!/^[\da-fA-F]{6}$/.test(n)) return `rgba(0,0,0,${opacity})`;
  return `rgba(${Number.parseInt(n.slice(0,2),16)},${Number.parseInt(n.slice(2,4),16)},${Number.parseInt(n.slice(4,6),16)},${opacity / 100})`;
}

export function LivePreview({ style }: Props): JSX.Element {
  const bg = style.backgroundEnabled ? toRgba(style.backgroundColor, style.backgroundOpacity) : 'transparent';
  const enFirst = style.lineOrder === 'en-first';
  const zhSize = Math.round(style.zhFontSizePercent / 100 * 18);
  const enSize = Math.round(style.enFontSizePercent / 100 * 14);
  const strokeW = Math.max(0, style.strokeWidth ?? 1);

  return (
    <div className="sp-live-preview" style={{ background: BG_AGENT }}>
      <div className="sp-live-preview-inner" style={{ background: bg, borderRadius: style.backgroundEnabled ? 8 : 0 }}>
        {enFirst && (
          <div className="sp-live-preview-en" style={{ color: style.enColor, fontSize: enSize, fontFamily: style.enFontFamily, fontWeight: style.enFontWeight, WebkitTextStroke: `${strokeW}px rgba(0,0,0,0.85)`, textShadow: `0 1px 2px rgba(0,0,0,${0.58 * style.shadowStrength / 100})` }}>
            This is a live preview of subtitle settings.
          </div>
        )}
        <div className="sp-live-preview-zh" style={{ color: style.zhColor, fontSize: zhSize, fontFamily: style.zhFontFamily, fontWeight: style.zhFontWeight, WebkitTextStroke: `${strokeW}px rgba(0,0,0,0.85)`, textShadow: `0 1px 2px rgba(0,0,0,${0.45 * style.shadowStrength / 100}), 0 0 8px rgba(0,0,0,${0.4 * style.shadowStrength / 100})`, paintOrder: 'stroke fill' }}>
          这是一个实时预览的字幕示例
        </div>
        {!enFirst && (
          <div className="sp-live-preview-en" style={{ color: style.enColor, fontSize: enSize, fontFamily: style.enFontFamily, fontWeight: style.enFontWeight, textShadow: `0 1px 2px rgba(0,0,0,${0.58 * style.shadowStrength / 100})` }}>
            This is a live preview of subtitle settings.
          </div>
        )}
      </div>
    </div>
  );
}
