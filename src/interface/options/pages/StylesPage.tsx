import { useEffect, useState } from 'react';

import {
  getSettings,
  updateSettings,
  updateStyleSettings,
} from '@/interface/shared-ui/settings-client';
import { SUBTITLE_STYLE_PRESETS } from '@/shared/subtitle-style-presets';
import type {
  AppSettings,
  SavedSubtitleStylePreset,
  SubtitleStyle,
} from '@/shared/types';

const CUSTOM_VALUE = '__custom__';

interface FontPreset {
  label: string;
  description: string;
  value: string;
}

interface TextStrengthPreset {
  id: string;
  label: string;
  description: string;
  zhFontWeight: number;
  enFontWeight: number;
}

interface ColorPreset {
  label: string;
  value: string;
}

const zhFontPresets: FontPreset[] = [
  {
    label: '系统清爽',
    description: '跟随 macOS / Windows 的默认中文字体，稳定清晰',
    value:
      '"PingFang SC", "Microsoft YaHei UI", "Noto Sans SC", system-ui, sans-serif',
  },
  {
    label: '雅黑稳重',
    description: 'Windows 上更熟悉，适合教程、访谈、演讲',
    value:
      '"Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif',
  },
  {
    label: '苹方柔和',
    description: 'macOS 上更圆润，长时间观看不刺眼',
    value:
      '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", sans-serif',
  },
  {
    label: '思源现代',
    description: '字形干净，适合科技、课程类视频',
    value:
      '"Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei UI", sans-serif',
  },
];

const enFontPresets: FontPreset[] = [
  {
    label: '现代清爽',
    description: '英文字幕默认选择，干净、贴近系统界面',
    value: '"Inter", "SF Pro Text", "Segoe UI", system-ui, sans-serif',
  },
  {
    label: '系统默认',
    description: '跟随当前设备字体，兼容性最好',
    value: 'system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
  {
    label: '视频字幕感',
    description: '接近常见视频平台字幕，识别速度快',
    value: '"Roboto", "Arial", "Helvetica Neue", sans-serif',
  },
  {
    label: '稳重阅读',
    description: '字面更宽，适合信息量较高的视频',
    value: '"Helvetica Neue", "Arial", "Segoe UI", sans-serif',
  },
];

const textStrengthPresets: TextStrengthPreset[] = [
  {
    id: 'compact',
    label: '轻巧',
    description: '少遮挡，适合课程和演示',
    zhFontWeight: 760,
    enFontWeight: 480,
  },
  {
    id: 'standard',
    label: '标准',
    description: '日常观看的均衡选择',
    zhFontWeight: 800,
    enFontWeight: 500,
  },
  {
    id: 'cinema',
    label: '影院',
    description: '全屏观看更清楚',
    zhFontWeight: 820,
    enFontWeight: 540,
  },
  {
    id: 'contrast',
    label: '醒目',
    description: '画面复杂时更容易看见',
    zhFontWeight: 860,
    enFontWeight: 620,
  },
];

const zhColorPresets: ColorPreset[] = [
  { label: '白色', value: '#FFFFFF' },
  { label: '柔白', value: '#F8FAFC' },
  { label: '暖白', value: '#FFF7ED' },
  { label: '浅黄', value: '#FEF3C7' },
];

const enColorPresets: ColorPreset[] = [
  { label: '冷灰', value: '#C8D0DC' },
  { label: '银白', value: '#E5E7EB' },
  { label: '柔蓝', value: '#D8DEE9' },
  { label: '暖黄', value: '#FFE8A3' },
];

const highlightColorPresets: ColorPreset[] = [
  { label: '红', value: '#FF4D4D' },
  { label: '橙', value: '#F97316' },
  { label: '蓝', value: '#38BDF8' },
  { label: '绿', value: '#22C55E' },
];

const backgroundColorPresets: ColorPreset[] = [
  { label: '纯黑', value: '#000000' },
  { label: '墨灰', value: '#111827' },
  { label: '深蓝', value: '#0F172A' },
  { label: '炭黑', value: '#18181B' },
];

interface Props {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function StylesPage({ settings, onSettingsChange }: Props): JSX.Element {
  const [presetName, setPresetName] = useState('');
  const [selectedSavedPresetId, setSelectedSavedPresetId] = useState('');
  const savedStylePresets = settings.stylePresets;
  const selectedSavedPreset =
    savedStylePresets.find((preset) => preset.id === selectedSavedPresetId) ??
    savedStylePresets[0];

  useEffect(() => {
    if (savedStylePresets.length === 0) {
      if (selectedSavedPresetId) {
        setSelectedSavedPresetId('');
      }
      return;
    }

    if (
      !savedStylePresets.some((preset) => preset.id === selectedSavedPresetId)
    ) {
      setSelectedSavedPresetId(savedStylePresets[0].id);
    }
  }, [savedStylePresets, selectedSavedPresetId]);

  const updateStyle = async (patch: Partial<SubtitleStyle>): Promise<void> => {
    await updateStyleSettings(patch);
    const next = await getSettings();
    onSettingsChange(next);
  };

  const updateSavedStylePresets = async (
    stylePresets: SavedSubtitleStylePreset[],
  ): Promise<void> => {
    const next = await updateSettings({ stylePresets });
    onSettingsChange(next);
  };

  const saveCurrentStylePreset = async (): Promise<void> => {
    const preset: SavedSubtitleStylePreset = {
      id: createPresetId(),
      name: presetName.trim() || `我的样式 ${savedStylePresets.length + 1}`,
      style: snapshotSubtitleStyle(settings.style),
      createdAt: new Date().toISOString(),
    };

    await updateSavedStylePresets([...savedStylePresets, preset]);
    setSelectedSavedPresetId(preset.id);
    setPresetName('');
  };

  const deleteSelectedStylePreset = async (): Promise<void> => {
    if (!selectedSavedPreset) {
      return;
    }

    await updateSavedStylePresets(
      savedStylePresets.filter(
        (preset) => preset.id !== selectedSavedPreset.id,
      ),
    );
  };

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Subtitle Layout</p>
          <h2>专业级默认排版</h2>
          <p className="muted">这里对齐规划书第 15 节的默认视觉规范。</p>
        </div>
      </div>

      <div className="content-card stack-md">
        <div className="section-heading-row">
          <div>
            <h3>样式模板</h3>
            <p className="section-hint">
              内置模板一键套用，也可以保存自己的当前样式。
            </p>
          </div>
        </div>
        <div className="template-grid">
          {SUBTITLE_STYLE_PRESETS.map((template) => (
            <button
              className="template-button"
              key={template.id}
              type="button"
              onClick={() => void updateStyle(template.style)}
            >
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>

        <div className="custom-template-panel">
          <div className="preset-save-grid">
            <label>
              <span>保存当前样式为模板</span>
              <input
                placeholder={`我的样式 ${savedStylePresets.length + 1}`}
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
              />
            </label>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void saveCurrentStylePreset()}
            >
              保存当前样式
            </button>
          </div>

          {savedStylePresets.length > 0 ? (
            <div className="saved-template-grid">
              <label>
                <span>我的模板</span>
                <select
                  value={selectedSavedPreset?.id ?? ''}
                  onChange={(event) =>
                    setSelectedSavedPresetId(event.target.value)
                  }
                >
                  {savedStylePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="actions-inline preset-actions">
                <button
                  className="btn btn-secondary"
                  disabled={!selectedSavedPreset}
                  type="button"
                  onClick={() =>
                    selectedSavedPreset
                      ? void updateStyle(selectedSavedPreset.style)
                      : undefined
                  }
                >
                  套用
                </button>
                <button
                  className="ghost-button compact"
                  disabled={!selectedSavedPreset}
                  type="button"
                  onClick={() => void deleteSelectedStylePreset()}
                >
                  删除
                </button>
              </div>
            </div>
          ) : (
            <p className="empty-hint">
              还没有自定义模板。调好字体、颜色、底板后可以保存下来反复使用。
            </p>
          )}
        </div>
      </div>

      <div className="content-card stack-md">
        <h3>排版与位置</h3>
        <div className="form-grid">
          <label className="checkbox-row">
            <input
              checked={settings.style.showChinese !== false}
              type="checkbox"
              onChange={(event) =>
                void updateStyle({ showChinese: event.target.checked })
              }
            />
            <span>显示中文翻译</span>
          </label>
          <label className="checkbox-row">
            <input
              checked={settings.style.showEnglish !== false}
              type="checkbox"
              onChange={(event) =>
                void updateStyle({ showEnglish: event.target.checked })
              }
            />
            <span>显示英文原文</span>
          </label>
          <label>
            <span>
              中文大小：{formatFontSizeLabel(settings.style.zhFontSizePercent)}
            </span>
            <input
              max={140}
              min={80}
              type="range"
              value={settings.style.zhFontSizePercent}
              onChange={(event) =>
                void updateStyle({
                  zhFontSizePercent: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            <span>
              英文大小：{formatFontSizeLabel(settings.style.enFontSizePercent)}
            </span>
            <input
              max={140}
              min={80}
              type="range"
              value={settings.style.enFontSizePercent}
              onChange={(event) =>
                void updateStyle({
                  enFontSizePercent: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            <span>字幕顺序</span>
            <select
              value={settings.style.lineOrder}
              onChange={(event) =>
                void updateStyle({
                  lineOrder: event.target.value as SubtitleStyle['lineOrder'],
                })
              }
            >
              <option value="zh-first">中文在上，英文在下</option>
              <option value="en-first">英文在上，中文在下</option>
            </select>
          </label>
          <label>
            <span>距底部：{settings.style.bottomOffsetPercent}%</span>
            <input
              max={20}
              min={6}
              type="range"
              value={settings.style.bottomOffsetPercent}
              onChange={(event) =>
                void updateStyle({
                  bottomOffsetPercent: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            <span>最大宽度：{settings.style.maxWidthPercent}%</span>
            <input
              max={96}
              min={45}
              type="range"
              value={settings.style.maxWidthPercent}
              onChange={(event) =>
                void updateStyle({
                  maxWidthPercent: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            <span>行高：{settings.style.lineHeightPercent}%</span>
            <input
              max={130}
              min={80}
              type="range"
              value={settings.style.lineHeightPercent}
              onChange={(event) =>
                void updateStyle({
                  lineHeightPercent: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            <span>中英间距：{settings.style.lineGapPercent}%</span>
            <input
              max={60}
              min={0}
              type="range"
              value={settings.style.lineGapPercent}
              onChange={(event) =>
                void updateStyle({ lineGapPercent: Number(event.target.value) })
              }
            />
          </label>
        </div>

        {settings.style.customPosition && (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void updateStyle({ customPosition: undefined })}
          >
            重置字幕位置（回到底部居中）
          </button>
        )}
      </div>

      <div className="content-card stack-md">
        <h3>文字颜色与高亮</h3>
        <div className="form-grid relaxed-grid">
          <ColorChoiceGroup
            label="中文颜色"
            options={zhColorPresets}
            value={settings.style.zhColor}
            onChange={(value) => void updateStyle({ zhColor: value })}
          />
          <ColorChoiceGroup
            label="英文颜色"
            options={enColorPresets}
            value={settings.style.enColor}
            onChange={(value) => void updateStyle({ enColor: value })}
          />
          <ColorChoiceGroup
            label="跟读高亮"
            options={highlightColorPresets}
            value={settings.style.highlightColor}
            onChange={(value) => void updateStyle({ highlightColor: value })}
          />
          <div className="choice-field">
            <span className="field-label">文字醒目程度</span>
            <div
              className="choice-grid"
              role="radiogroup"
              aria-label="文字醒目程度"
            >
              {textStrengthPresets.map((preset) => {
                const isActive =
                  settings.style.zhFontWeight === preset.zhFontWeight &&
                  settings.style.enFontWeight === preset.enFontWeight;

                return (
                  <button
                    aria-pressed={isActive}
                    className={isActive ? 'choice-card active' : 'choice-card'}
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      void updateStyle({
                        zhFontWeight: preset.zhFontWeight,
                        enFontWeight: preset.enFontWeight,
                      })
                    }
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label>
            <span>描边强度：{settings.style.strokeWidth}px</span>
            <input
              max={3}
              min={0}
              step={0.1}
              type="range"
              value={settings.style.strokeWidth}
              onChange={(event) =>
                void updateStyle({ strokeWidth: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>阴影强度：{settings.style.shadowStrength}%</span>
            <input
              max={100}
              min={0}
              type="range"
              value={settings.style.shadowStrength}
              onChange={(event) =>
                void updateStyle({ shadowStrength: Number(event.target.value) })
              }
            />
          </label>
        </div>
      </div>

      <div className="content-card stack-md">
        <h3>字体与底板</h3>
        <div className="form-grid relaxed-grid">
          <FontPresetSelect
            label="中文字体"
            options={zhFontPresets}
            value={settings.style.zhFontFamily}
            onChange={(value) => void updateStyle({ zhFontFamily: value })}
          />
          <FontPresetSelect
            label="英文字体"
            options={enFontPresets}
            value={settings.style.enFontFamily}
            onChange={(value) => void updateStyle({ enFontFamily: value })}
          />
          <details className="advanced-control full-span">
            <summary>高级自定义字体</summary>
            <div className="advanced-grid">
              <label>
                <span>中文自定义字体</span>
                <input
                  value={settings.style.zhFontFamily}
                  onChange={(event) =>
                    void updateStyle({ zhFontFamily: event.target.value })
                  }
                />
              </label>
              <label>
                <span>英文自定义字体</span>
                <input
                  value={settings.style.enFontFamily}
                  onChange={(event) =>
                    void updateStyle({ enFontFamily: event.target.value })
                  }
                />
              </label>
            </div>
          </details>
          <label className="checkbox-row">
            <input
              checked={settings.style.backgroundEnabled}
              type="checkbox"
              onChange={(event) =>
                void updateStyle({ backgroundEnabled: event.target.checked })
              }
            />
            <span>启用字幕底板</span>
          </label>
          <ColorChoiceGroup
            label="底板颜色"
            options={backgroundColorPresets}
            value={settings.style.backgroundColor}
            onChange={(value) => void updateStyle({ backgroundColor: value })}
          />
          <label>
            <span>底板透明度：{settings.style.backgroundOpacity}%</span>
            <input
              max={85}
              min={0}
              type="range"
              value={settings.style.backgroundOpacity}
              onChange={(event) =>
                void updateStyle({
                  backgroundOpacity: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      </div>

      <div className="content-card stack-md">
        <h3>预览</h3>
        <div
          className="preview-card"
          style={{
            background: settings.style.backgroundEnabled
              ? colorWithOpacity(
                  settings.style.backgroundColor,
                  settings.style.backgroundOpacity,
                )
              : undefined,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <p
            style={{
              color: settings.style.zhColor,
              fontFamily: settings.style.zhFontFamily,
              fontWeight: settings.style.zhFontWeight,
              display:
                settings.style.showChinese !== false ? 'block' : 'none',
              fontSize: getPreviewZhFontSize(settings.style.zhFontSizePercent),
              lineHeight: getPreviewLineHeight(settings.style.lineHeightPercent),
              marginTop:
                settings.style.lineOrder === 'en-first'
                  ? `${settings.style.lineGapPercent / 3}px`
                  : 0,
              order: settings.style.lineOrder === 'en-first' ? 2 : 1,
            }}
          >
            一个演示文稿、电子表格、文档
          </p>
          <p
            style={{
              color: settings.style.enColor,
              fontFamily: settings.style.enFontFamily,
              fontWeight: settings.style.enFontWeight,
              display:
                settings.style.showEnglish !== false ? 'block' : 'none',
              fontSize: getPreviewEnFontSize(settings.style.enFontSizePercent),
              lineHeight: getPreviewLineHeight(settings.style.lineHeightPercent),
              marginTop:
                settings.style.lineOrder === 'zh-first'
                  ? `${settings.style.lineGapPercent / 3}px`
                  : 0,
              order: settings.style.lineOrder === 'en-first' ? 1 : 2,
            }}
          >
            A deck, spreadsheets,{' '}
            <span
              style={{
                color: settings.style.highlightColor,
                fontWeight: 700,
                textDecoration: 'underline',
                textDecorationColor: settings.style.highlightColor,
                textDecorationSkipInk: 'none',
                textDecorationThickness: 2,
                textUnderlineOffset: 4,
              }}
            >
              documents
            </span>
            , the
          </p>
        </div>
      </div>
    </section>
  );
}

function FontPresetSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FontPreset[];
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  const currentOption = options.find((option) => option.value === value);

  return (
    <label className="font-preset-field">
      <span>{label}</span>
      <select
        value={currentOption?.value ?? CUSTOM_VALUE}
        onChange={(event) => {
          if (event.target.value !== CUSTOM_VALUE) {
            onChange(event.target.value);
          }
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>自定义</option>
      </select>
      <small>{currentOption?.description ?? '当前正在使用自定义字体。'}</small>
    </label>
  );
}

function ColorChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ColorPreset[];
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  const normalizedValue = normalizeHex(value);
  const isPresetValue = options.some(
    (option) => normalizeHex(option.value) === normalizedValue,
  );
  const safeValue = isHexColor(value) ? value : '#ffffff';

  return (
    <div className="color-control">
      <span className="field-label">{label}</span>
      <div className="color-choice-row" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const isActive = normalizeHex(option.value) === normalizedValue;

          return (
            <button
              aria-pressed={isActive}
              className={isActive ? 'color-chip active' : 'color-chip'}
              key={`${label}-${option.value}`}
              type="button"
              onClick={() => onChange(option.value)}
            >
              <span
                className="color-swatch"
                style={{ backgroundColor: option.value }}
              />
              <span>{option.label}</span>
            </button>
          );
        })}
        <label
          className={
            isPresetValue ? 'color-chip custom' : 'color-chip custom active'
          }
        >
          <input
            aria-label={`${label}自定义颜色`}
            type="color"
            value={safeValue}
            onChange={(event) => onChange(event.target.value)}
          />
          <span
            className="color-swatch"
            style={{ backgroundColor: safeValue }}
          />
          <span>自定义</span>
        </label>
      </div>
    </div>
  );
}

function colorWithOpacity(hex: string, opacityPercent: number): string {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    return '#111827';
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacityPercent / 100})`;
}

function normalizeHex(value: string): string {
  return value.trim().toUpperCase();
}

function isHexColor(value: string): boolean {
  return /^#[\da-fA-F]{6}$/.test(value.trim());
}

function formatFontSizeLabel(scalePercent: number): string {
  if (scalePercent < 92) {
    return `偏小（${scalePercent}%）`;
  }
  if (scalePercent < 108) {
    return `标准（${scalePercent}%）`;
  }
  if (scalePercent < 124) {
    return `偏大（${scalePercent}%）`;
  }
  return `很大（${scalePercent}%）`;
}

function getPreviewZhFontSize(scalePercent: number): number {
  return Math.round((28 * scalePercent) / 100);
}

function getPreviewEnFontSize(scalePercent: number): number {
  return Math.round((20 * scalePercent) / 100);
}

function getPreviewLineHeight(percent: number): number {
  return Number((1.28 * (percent / 100)).toFixed(2));
}

function createPresetId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function snapshotSubtitleStyle(style: SubtitleStyle): SubtitleStyle {
  const snapshot: SubtitleStyle = { ...style };
  delete snapshot.customPosition;
  return snapshot;
}
