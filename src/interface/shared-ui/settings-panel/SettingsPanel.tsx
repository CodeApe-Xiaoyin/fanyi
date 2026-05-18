import { useState } from 'react';

import type { AppSettings, SubtitleStyle } from '@/shared/types';

import { SettingsNav, type SettingsPage } from './SettingsNav';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { SubtitleLanguagePage } from './pages/SubtitleLanguagePage';
import { SubtitleStylePage } from './pages/SubtitleStylePage';
import { TranslationSettingsPage } from './pages/TranslationSettingsPage';
import { WebTranslatePage } from './pages/WebTranslatePage';
import { YouTubeThemePage } from './pages/YouTubeThemePage';

import './settings-panel.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (next: AppSettings) => void;
  onStyleChange: (patch: Partial<SubtitleStyle>) => Promise<AppSettings>;
  onClose?: () => void;
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  onStyleChange,
  onClose,
}: SettingsPanelProps): JSX.Element {
  const [activePage, setActivePage] = useState<SettingsPage>('subtitle-language');

  return (
    <div className="sp-dialog" style={{ position: 'relative' }}>
      {onClose && (
        <button
          type="button"
          className="sp-dialog-close"
          onClick={onClose}
          aria-label="关闭设置"
        >
          ×
        </button>
      )}
      <SettingsNav activePage={activePage} onPageChange={setActivePage} />
      <div className="sp-content">
        {activePage === 'subtitle-language' && (
          <SubtitleLanguagePage
            settings={settings}
            onSettingsChange={onSettingsChange}
          />
        )}
        {activePage === 'subtitle-style' && (
          <SubtitleStylePage
            settings={settings}
            onStyleChange={onStyleChange}
          />
        )}
        {activePage === 'youtube-theme' && <YouTubeThemePage />}
        {activePage === 'translation-settings' && (
          <TranslationSettingsPage
            settings={settings}
            onSettingsChange={onSettingsChange}
          />
        )}
        {activePage === 'web-translate' && <WebTranslatePage />}
        {activePage === 'accessibility' && (
          <AccessibilityPage settings={settings} />
        )}
        {activePage === 'feedback' && <FeedbackPage />}
      </div>
    </div>
  );
}
