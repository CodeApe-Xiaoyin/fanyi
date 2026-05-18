import { useEffect, useRef, useState } from 'react';
import type { BilingualCue } from '@/domain/models/Cue';
import type { AppSettings } from '@/shared/types';
import { SubtitleTab } from './tabs/SubtitleTab';
import { TranscriptionTab } from './tabs/TranscriptionTab';
import { SummaryTab } from './tabs/SummaryTab';
import { SegmentsTab } from './tabs/SegmentsTab';

type TabKey = 'subtitle' | 'transcription' | 'summary' | 'segments';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'subtitle', label: '字幕' },
  { key: 'transcription', label: 'AI转录' },
  { key: 'summary', label: '总结+' },
  { key: 'segments', label: '片段' },
];

interface Props {
  cues: BilingualCue[];
  video: HTMLVideoElement;
  settings: AppSettings;
}

export function SidePanelApp({ cues, video, settings }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('subtitle');
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className="sp2-root">
      <div className="sp2-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`sp2-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="sp2-body" ref={bodyRef}>
        {activeTab === 'subtitle' && <SubtitleTab cues={cues} video={video} />}
        {activeTab === 'transcription' && <TranscriptionTab cues={cues} />}
        {activeTab === 'summary' && <SummaryTab cues={cues} settings={settings} videoContext={{ videoId: '', title: '' }} />}
        {activeTab === 'segments' && <SegmentsTab cues={cues} video={video} settings={settings} />}
      </div>
    </div>
  );
}
