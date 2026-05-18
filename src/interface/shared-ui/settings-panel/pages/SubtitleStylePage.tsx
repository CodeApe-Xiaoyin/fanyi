import type { SubtitleStyle } from '@/shared/types';
import { SUBTITLE_STYLE_PRESETS, type SubtitleStylePreset } from '@/shared/subtitle-style-presets';
import { DEFAULT_STYLE } from '@/shared/types';
import { LivePreview } from '../components/LivePreview';
import { StylePresetCard } from '../components/StylePresetCard';

interface Props {
  settings: { style: SubtitleStyle };
  onStyleChange: (patch: Partial<SubtitleStyle>) => Promise<unknown>;
}

function getMatchingPreset(style: SubtitleStyle): SubtitleStylePreset | null {
  for (const preset of SUBTITLE_STYLE_PRESETS) {
    const p = preset.style;
    if (
      (p.backgroundEnabled === undefined || p.backgroundEnabled === style.backgroundEnabled) &&
      (p.backgroundColor === undefined || p.backgroundColor.toLowerCase() === style.backgroundColor.toLowerCase()) &&
      (p.zhColor === undefined || p.zhColor.toLowerCase() === style.zhColor.toLowerCase()) &&
      (p.enColor === undefined || p.enColor.toLowerCase() === style.enColor.toLowerCase()) &&
      (p.highlightColor === undefined || p.highlightColor.toLowerCase() === style.highlightColor.toLowerCase())
    ) return preset;
  }
  return null;
}

export function SubtitleStylePage({ settings, onStyleChange }: Props): JSX.Element {
  const s = settings.style;
  const activePreset = getMatchingPreset(s);

  const update = (patch: Partial<SubtitleStyle>) => { void onStyleChange(patch); };

  return (
    <div>
      <h1 className="sp-page-title">字幕样式</h1>

      <LivePreview style={s} />

      <div className="sp-section-label">官方推荐样式预设</div>
      <div className="sp-presets-grid">
        {SUBTITLE_STYLE_PRESETS.map((preset) => (
          <StylePresetCard
            key={preset.id}
            preset={preset}
            isActive={activePreset?.id === preset.id}
            onApply={() => update(preset.style)}
          />
        ))}
      </div>

      <div className="sp-section-label">自定义样式</div>
      <div className="sp-controls-grid">

        <div className="sp-control-group">
          <div className="sp-control-group-title">显示设置</div>
          <div className="sp-label">
            <span>显示中文</span>
            <input type="checkbox" checked={s.showChinese} onChange={(e) => update({ showChinese: e.target.checked })} />
          </div>
          <div className="sp-label">
            <span>显示英文</span>
            <input type="checkbox" checked={s.showEnglish} onChange={(e) => update({ showEnglish: e.target.checked })} />
          </div>
          <div className="sp-label">
            <span>行序</span>
            <select value={s.lineOrder} onChange={(e) => update({ lineOrder: e.target.value as SubtitleStyle['lineOrder'] })}>
              <option value="zh-first">中文在上</option>
              <option value="en-first">英文在上</option>
            </select>
          </div>
        </div>

        <div className="sp-control-group">
          <div className="sp-control-group-title">字号</div>
          <div className="sp-label">
            <span>中文 {s.zhFontSizePercent}%</span>
            <input type="range" min={80} max={140} value={s.zhFontSizePercent} onChange={(e) => update({ zhFontSizePercent: Number(e.target.value) })} />
          </div>
          <div className="sp-label">
            <span>英文 {s.enFontSizePercent}%</span>
            <input type="range" min={80} max={140} value={s.enFontSizePercent} onChange={(e) => update({ enFontSizePercent: Number(e.target.value) })} />
          </div>
        </div>

        <div className="sp-control-group">
          <div className="sp-control-group-title">字号粗细预设</div>
          {[
            { label: '紧凑', zh: 700, en: 440, stroke: 0.6, shadow: 46 },
            { label: '标准', zh: 800, en: 500, stroke: 1, shadow: 60 },
            { label: '影院', zh: 820, en: 540, stroke: 1.2, shadow: 72 },
            { label: '高对比', zh: 860, en: 620, stroke: 1.5, shadow: 88 },
          ].map((w) => (
            <div key={w.label} className="sp-label">
              <span>{w.label}</span>
              <button className="sp-btn small" onClick={() => update({ zhFontWeight: w.zh, enFontWeight: w.en, strokeWidth: w.stroke, shadowStrength: w.shadow })}>应用</button>
            </div>
          ))}
        </div>

        <div className="sp-control-group">
          <div className="sp-control-group-title">颜色</div>
          <div className="sp-label">
            <span>中文颜色</span>
            <input type="color" value={s.zhColor} onInput={(e) => update({ zhColor: (e.target as HTMLInputElement).value })} />
          </div>
          <div className="sp-label">
            <span>英文颜色</span>
            <input type="color" value={s.enColor} onInput={(e) => update({ enColor: (e.target as HTMLInputElement).value })} />
          </div>
          <div className="sp-label">
            <span>高亮颜色</span>
            <input type="color" value={s.highlightColor} onInput={(e) => update({ highlightColor: (e.target as HTMLInputElement).value })} />
          </div>
        </div>

        <div className="sp-control-group">
          <div className="sp-control-group-title">布局</div>
          <div className="sp-label">
            <span>宽度 {s.maxWidthPercent}%</span>
            <input type="range" min={45} max={96} value={s.maxWidthPercent} onChange={(e) => update({ maxWidthPercent: Number(e.target.value) })} />
          </div>
          <div className="sp-label">
            <span>底部偏移 {s.bottomOffsetPercent}%</span>
            <input type="range" min={6} max={20} value={s.bottomOffsetPercent} onChange={(e) => update({ bottomOffsetPercent: Number(e.target.value) })} />
          </div>
          <div className="sp-label">
            <span>行间距 {s.lineGapPercent}%</span>
            <input type="range" min={0} max={60} value={s.lineGapPercent} onChange={(e) => update({ lineGapPercent: Number(e.target.value) })} />
          </div>
          <div className="sp-label">
            <span>行高 {s.lineHeightPercent}%</span>
            <input type="range" min={80} max={130} value={s.lineHeightPercent} onChange={(e) => update({ lineHeightPercent: Number(e.target.value) })} />
          </div>
        </div>

        <div className="sp-control-group">
          <div className="sp-control-group-title">文字效果</div>
          <div className="sp-label">
            <span>描边 {s.strokeWidth}px</span>
            <input type="range" min={0} max={3} step={0.1} value={s.strokeWidth} onChange={(e) => update({ strokeWidth: Number(e.target.value) })} />
          </div>
          <div className="sp-label">
            <span>投影 {s.shadowStrength}%</span>
            <input type="range" min={0} max={100} value={s.shadowStrength} onChange={(e) => update({ shadowStrength: Number(e.target.value) })} />
          </div>
        </div>

        <div className="sp-control-group">
          <div className="sp-control-group-title">中文字体</div>
          <div className="sp-label">
            <span>预设字体</span>
            <select
              value={s.zhFontFamily}
              onChange={(e) => update({ zhFontFamily: e.target.value })}
            >
              <option value={DEFAULT_STYLE.zhFontFamily}>系统默认</option>
              <option value='"PingFang SC","Microsoft YaHei",sans-serif'>PingFang + 雅黑</option>
              <option value='"Noto Sans SC","Source Han Sans SC",sans-serif'>Noto + 思源</option>
              <option value='"LXGW WenKai","KaiTi",serif'>霞鹜文楷 / 楷体</option>
            </select>
          </div>
          <div className="sp-label">
            <span>自定义</span>
            <input
              type="text"
              value={s.zhFontFamily}
              onChange={(e) => update({ zhFontFamily: e.target.value })}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', width: '100%', minWidth: 200 }}
            />
          </div>
        </div>

        <div className="sp-control-group">
          <div className="sp-control-group-title">英文字体</div>
          <div className="sp-label">
            <span>预设字体</span>
            <select
              value={s.enFontFamily}
              onChange={(e) => update({ enFontFamily: e.target.value })}
            >
              <option value={DEFAULT_STYLE.enFontFamily}>系统默认</option>
              <option value='"Inter","SF Pro Text",sans-serif'>Inter + SF Pro</option>
              <option value='"Roboto","Segoe UI",sans-serif'>Roboto + Segoe</option>
              <option value='"JetBrains Mono","Fira Code",monospace'>JetBrains / Fira (等宽)</option>
            </select>
          </div>
          <div className="sp-label">
            <span>自定义</span>
            <input
              type="text"
              value={s.enFontFamily}
              onChange={(e) => update({ enFontFamily: e.target.value })}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', width: '100%', minWidth: 200 }}
            />
          </div>
        </div>

        <div className="sp-control-group">
          <div className="sp-control-group-title">字幕背景</div>
          <div className="sp-label">
            <span>启用背景</span>
            <input type="checkbox" checked={s.backgroundEnabled} onChange={(e) => update({ backgroundEnabled: e.target.checked })} />
          </div>
          <div className="sp-label">
            <span>背景颜色</span>
            <input type="color" value={s.backgroundColor} onInput={(e) => update({ backgroundColor: (e.target as HTMLInputElement).value })} />
          </div>
          <div className="sp-label">
            <span>不透明度 {s.backgroundOpacity}%</span>
            <input type="range" min={0} max={85} value={s.backgroundOpacity} onChange={(e) => update({ backgroundOpacity: Number(e.target.value) })} />
          </div>
        </div>

      </div>
    </div>
  );
}
