import { useEffect, useRef, useState } from 'react';

import {
  activateProvider,
  getSettings,
  updateEnabled,
  updateSettings,
  updateStyleSettings,
} from '@/interface/shared-ui/settings-client';
import { SUBTITLE_STYLE_PRESETS } from '@/shared/subtitle-style-presets';
import { DEFAULT_STYLE, type AppSettings, type SubtitleStyle } from '@/shared/types';

interface PopupStyleTemplate {
  id: string;
  label: string;
  style: Partial<SubtitleStyle>;
}

const languagePresets = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
];

function withCurrentLanguage(currentValue: string): typeof languagePresets {
  if (languagePresets.some((item) => item.value === currentValue)) {
    return languagePresets;
  }

  return [{ value: currentValue, label: currentValue }, ...languagePresets];
}

export function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const styleUpdateRevision = useRef(0);
  const styleSaveQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  const toggleEnabled = async (): Promise<void> => {
    if (!settings) {
      return;
    }

    setSaving(true);
    try {
      const next = await updateEnabled(!settings.enabled);
      setSettings(next);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = async (
    patch: Parameters<typeof updateSettings>[0],
    message: string,
  ): Promise<void> => {
    setSaving(true);
    setStatusMessage('');
    try {
      const next = await updateSettings(patch);
      setSettings(next);
      setStatusMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const updateStyle = async (
    patch: Partial<SubtitleStyle>,
    message: string,
  ): Promise<void> => {
    const revision = ++styleUpdateRevision.current;
    setStatusMessage('');
    setSettings((current) =>
      current
        ? {
            ...current,
            style: {
              ...current.style,
              ...patch,
            },
          }
        : current,
    );

    const saveTask = styleSaveQueue.current.then(
      () => updateStyleSettings(patch),
      () => updateStyleSettings(patch),
    );
    styleSaveQueue.current = saveTask.catch(() => undefined);

    try {
      const next = await saveTask;
      if (revision === styleUpdateRevision.current) {
        setSettings(next);
        setStatusMessage(message);
      }
    } catch {
      if (revision === styleUpdateRevision.current) {
        const next = await getSettings();
        setSettings(next);
        setStatusMessage('样式保存失败，请重试');
      }
    }
  };

  const switchProvider = async (providerId: string): Promise<void> => {
    if (!providerId) {
      return;
    }

    setSaving(true);
    setStatusMessage('');
    try {
      const next = await activateProvider(providerId);
      setSettings(next);
      setStatusMessage('服务商已切换');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="panel-shell popup-shell">
        <div className="popup-card">
          <p className="eyebrow">Fanyi</p>
          <h1>加载中...</h1>
        </div>
      </div>
    );
  }

  const targetLanguageOptions = withCurrentLanguage(settings.targetLanguage);
  const sourceLanguageOptions = withCurrentLanguage(
    settings.preferredCaptionLanguage,
  );
  const savedStylePresets = settings.stylePresets;
  const styleTemplateOptions: PopupStyleTemplate[] = [
    ...SUBTITLE_STYLE_PRESETS.map((template) => ({
      id: `builtin:${template.id}`,
      label: template.name,
      style: template.style,
    })),
    ...savedStylePresets.map((template) => ({
      id: `saved:${template.id}`,
      label: template.name,
      style: template.style,
    })),
  ];
  const matchedStyleTemplate = findMatchingStyleTemplate(
    settings.style,
    styleTemplateOptions,
  );
  const currentStyleTemplateValue = matchedStyleTemplate?.id ?? 'custom';

  const applyStyleTemplate = async (templateId: string): Promise<void> => {
    if (templateId === 'custom') {
      return;
    }

    const template = styleTemplateOptions.find(
      (item) => item.id === templateId,
    );
    if (!template) {
      return;
    }

    await updateStyle(template.style, `已应用「${template.label}」模板`);
  };

  return (
    <div className="panel-shell popup-shell">
      <div className="popup-card">
        <div className="popup-header">
          <p className="eyebrow">YouTube Bilingual Subtitles</p>
          <span
            className={settings.enabled ? 'status-pill active' : 'status-pill'}
          >
            {settings.enabled ? '已启用' : '已暂停'}
          </span>
        </div>

        <h1>Fanyi</h1>

        <div className="popup-meta popup-meta-controls">
          <label className="popup-meta-control">
            <span>服务商</span>
            <select
              disabled={saving || settings.llm.providers.length === 0}
              value={settings.llm.activeProviderId}
              onChange={(event) => void switchProvider(event.target.value)}
            >
              {settings.llm.providers.length === 0 ? (
                <option value="">未配置</option>
              ) : null}
              {settings.llm.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label className="popup-meta-control">
            <span>目标语言</span>
            <select
              disabled={saving}
              value={settings.targetLanguage}
              onChange={(event) =>
                void updateSetting(
                  { targetLanguage: event.target.value },
                  '目标语言已保存',
                )
              }
            >
              {targetLanguageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="popup-meta-control">
            <span>源字幕</span>
            <select
              disabled={saving}
              value={settings.preferredCaptionLanguage}
              onChange={(event) =>
                void updateSetting(
                  { preferredCaptionLanguage: event.target.value },
                  '源字幕语言已保存',
                )
              }
            >
              {sourceLanguageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="popup-actions">
        <button
          className="primary-button"
          disabled={saving}
          onClick={toggleEnabled}
          type="button"
        >
          {settings.enabled ? '关闭本页增强' : '开启本页增强'}
        </button>

        <button
          className="secondary-button"
          onClick={() => chrome.runtime.openOptionsPage()}
          type="button"
        >
          设置
        </button>
      </div>

      {statusMessage ? <p className="popup-status">{statusMessage}</p> : null}

      <section className="popup-section stack-sm" aria-label="字幕来源">
        <h2>字幕来源</h2>
        <label className="checkbox-row popup-check">
          <input
            checked={settings.allowAutoGeneratedCaptions}
            disabled={saving}
            type="checkbox"
            onChange={(event) =>
              void updateSetting(
                { allowAutoGeneratedCaptions: event.target.checked },
                '源字幕偏好已保存，正在重试当前视频',
              )
            }
          />
          <span>没有人工字幕时允许自动字幕</span>
        </label>
      </section>

      <section className="popup-section stack-sm" aria-label="字幕样式">
        <h2>字幕样式</h2>
        <label>
          <span>当前样式</span>
          <select
            disabled={saving}
            value={currentStyleTemplateValue}
            onChange={(event) => void applyStyleTemplate(event.target.value)}
          >
            <option value="custom">自定义</option>
            <optgroup label="内置模板">
              {SUBTITLE_STYLE_PRESETS.map((template) => (
                <option key={template.id} value={`builtin:${template.id}`}>
                  {template.name}
                </option>
              ))}
            </optgroup>
            {savedStylePresets.length > 0 ? (
              <optgroup label="我的模板">
                {savedStylePresets.map((template) => (
                  <option key={template.id} value={`saved:${template.id}`}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        <div className="style-mini-grid">
          <label className="checkbox-row popup-check">
            <input
              checked={settings.style.showChinese !== false}
              disabled={saving}
              type="checkbox"
              onChange={(event) =>
                void updateStyle(
                  { showChinese: event.target.checked },
                  '中文显示已保存',
                )
              }
            />
            <span>显示中文</span>
          </label>
          <label className="checkbox-row popup-check">
            <input
              checked={settings.style.showEnglish !== false}
              disabled={saving}
              type="checkbox"
              onChange={(event) =>
                void updateStyle(
                  { showEnglish: event.target.checked },
                  '英文显示已保存',
                )
              }
            />
            <span>显示英文</span>
          </label>
          <label>
            <span>
              中文大小 {formatFontSizeLabel(settings.style.zhFontSizePercent)}
            </span>
            <input
              disabled={saving}
              max={140}
              min={80}
              type="range"
              value={settings.style.zhFontSizePercent}
              onChange={(event) =>
                void updateStyle(
                  { zhFontSizePercent: Number(event.target.value) },
                  '中文大小已保存',
                )
              }
            />
          </label>
          <label>
            <span>
              英文大小 {formatFontSizeLabel(settings.style.enFontSizePercent)}
            </span>
            <input
              disabled={saving}
              max={140}
              min={80}
              type="range"
              value={settings.style.enFontSizePercent}
              onChange={(event) =>
                void updateStyle(
                  { enFontSizePercent: Number(event.target.value) },
                  '英文大小已保存',
                )
              }
            />
          </label>
          <label>
            <span>英文高亮颜色</span>
            <input
              disabled={saving}
              type="color"
              value={toColorInputValue(settings.style.highlightColor)}
              onInput={(event) =>
                void updateStyle(
                  { highlightColor: event.currentTarget.value },
                  '英文高亮颜色已保存',
                )
              }
            />
          </label>
          <label>
            <span>显示顺序</span>
            <select
              disabled={saving}
              value={settings.style.lineOrder}
              onChange={(event) =>
                void updateStyle(
                  {
                    lineOrder: event.target.value as SubtitleStyle['lineOrder'],
                  },
                  '字幕顺序已保存',
                )
              }
            >
              <option value="zh-first">中文在上</option>
              <option value="en-first">英文在上</option>
            </select>
          </label>
          <label>
            <span>字幕宽度 {settings.style.maxWidthPercent}%</span>
            <input
              disabled={saving}
              max={96}
              min={55}
              type="range"
              value={settings.style.maxWidthPercent}
              onChange={(event) =>
                void updateStyle(
                  { maxWidthPercent: Number(event.target.value) },
                  '字幕宽度已保存',
                )
              }
            />
          </label>
          <label>
            <span>行高 {formatLineHeightLabel(settings.style.lineHeightPercent)}</span>
            <input
              disabled={saving}
              max={130}
              min={80}
              type="range"
              value={settings.style.lineHeightPercent}
              onChange={(event) =>
                void updateStyle(
                  { lineHeightPercent: Number(event.target.value) },
                  '行高已保存',
                )
              }
            />
          </label>
          <label>
            <span>距底部 {settings.style.bottomOffsetPercent}%</span>
            <input
              disabled={saving}
              max={20}
              min={6}
              type="range"
              value={settings.style.bottomOffsetPercent}
              onChange={(event) =>
                void updateStyle(
                  { bottomOffsetPercent: Number(event.target.value) },
                  '字幕位置已保存',
                )
              }
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              disabled={saving}
              type="checkbox"
              checked={settings.style.backgroundEnabled}
              onChange={(event) =>
                void updateStyle(
                  { backgroundEnabled: event.target.checked },
                  '字幕背景已更新',
                )
              }
            />
            <span>字幕背景</span>
          </label>
          {settings.style.backgroundEnabled && (
            <>
              <label>
                <span>背景颜色</span>
                <input
                  disabled={saving}
                  type="color"
                  value={toColorInputValue(settings.style.backgroundColor)}
                  onInput={(event) =>
                    void updateStyle(
                      { backgroundColor: event.currentTarget.value },
                      '背景颜色已保存',
                    )
                  }
                />
              </label>
              <label>
                <span>背景不透明度 {settings.style.backgroundOpacity}%</span>
                <input
                  disabled={saving}
                  max={85}
                  min={0}
                  type="range"
                  value={settings.style.backgroundOpacity}
                  onChange={(event) =>
                    void updateStyle(
                      { backgroundOpacity: Number(event.target.value) },
                      '背景不透明度已保存',
                    )
                  }
                />
              </label>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function formatFontSizeLabel(scalePercent: number): string {
  if (scalePercent < 92) {
    return `偏小 ${scalePercent}%`;
  }
  if (scalePercent < 108) {
    return `标准 ${scalePercent}%`;
  }
  if (scalePercent < 124) {
    return `偏大 ${scalePercent}%`;
  }
  return `很大 ${scalePercent}%`;
}

function formatLineHeightLabel(percent: number): string {
  if (percent < 92) {
    return `紧凑 ${percent}%`;
  }
  if (percent < 108) {
    return `标准 ${percent}%`;
  }
  if (percent < 120) {
    return `舒展 ${percent}%`;
  }
  return `很松 ${percent}%`;
}

function toColorInputValue(value: string): string {
  return /^#[\da-fA-F]{6}$/.test(value.trim())
    ? value
    : DEFAULT_STYLE.highlightColor;
}

function findMatchingStyleTemplate(
  style: SubtitleStyle,
  templates: PopupStyleTemplate[],
): PopupStyleTemplate | undefined {
  const savedTemplates = templates.filter((template) =>
    template.id.startsWith('saved:'),
  );
  const builtinTemplates = templates.filter((template) =>
    template.id.startsWith('builtin:'),
  );

  return [...savedTemplates, ...builtinTemplates].find((template) =>
    styleMatchesTemplate(style, template.style),
  );
}

function styleMatchesTemplate(
  style: SubtitleStyle,
  templateStyle: Partial<SubtitleStyle>,
): boolean {
  const completeTemplateStyle: SubtitleStyle = {
    ...DEFAULT_STYLE,
    ...templateStyle,
  };
  const styleKeys = Object.keys(DEFAULT_STYLE) as Array<keyof typeof DEFAULT_STYLE>;

  return styleKeys.every((key) =>
    styleValueEquals(style[key], completeTemplateStyle[key]),
  );
}

function styleValueEquals(left: unknown, right: unknown): boolean {
  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }

  return left === right;
}
