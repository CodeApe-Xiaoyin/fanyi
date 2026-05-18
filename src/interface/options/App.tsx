import { useEffect, useState } from 'react';

import { getSettings } from '@/interface/shared-ui/settings-client';
import { updateStyleSettings } from '@/interface/shared-ui/settings-client';
import { SettingsPanel } from '@/interface/shared-ui/settings-panel/SettingsPanel';
import type { AppSettings, SubtitleStyle } from '@/shared/types';

export function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  if (!settings) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#94a3b8', font: '400 14px system-ui, sans-serif' }}>
        加载中...
      </div>
    );
  }

  const handleStyleChange = async (patch: Partial<SubtitleStyle>) => {
    const next = await updateStyleSettings(patch);
    setSettings(next);
    return next;
  };

  return (
    <SettingsPanel
      settings={settings}
      onSettingsChange={setSettings}
      onStyleChange={handleStyleChange}
    />
  );
}
