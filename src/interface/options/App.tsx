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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(100,120,180,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(60,80,140,0.04) 0%, transparent 50%), #0a0c14',
      padding: 32,
    }}>
      <SettingsPanel
        settings={settings}
        onSettingsChange={setSettings}
        onStyleChange={handleStyleChange}
      />
    </div>
  );
}
