import { useMemo } from 'react';
import type { BilingualCue } from '@/domain/models/Cue';

interface Props { cues: BilingualCue[]; }

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface Segment {
  sentenceId: string;
  start: number;
  end: number;
  text: string;
  translation: string;
}

function groupSegments(cues: BilingualCue[]): Segment[] {
  const map = new Map<string, Segment>();
  for (const cue of cues) {
    const g = map.get(cue.sentenceId);
    if (g) {
      g.end = Math.max(g.end, cue.end);
      g.text += ' ' + cue.text;
    } else {
      map.set(cue.sentenceId, {
        sentenceId: cue.sentenceId,
        start: cue.start,
        end: cue.end,
        text: cue.text,
        translation: cue.translation,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

export function TranscriptionTab({ cues }: Props): JSX.Element {
  const segments = useMemo(() => groupSegments(cues), [cues]);

  if (segments.length === 0) {
    return <div className="sp2-empty">暂无转录数据</div>;
  }

  return (
    <div className="sp2-list">
      {segments.map((seg) => (
        <div key={seg.sentenceId} className="sp2-cue" style={{ cursor: 'default', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="sp2-cue-time">{fmtTime(seg.start)}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {seg.sentenceId.includes('google') ? 'Google MT' : 'AI Polished'}
            </span>
          </div>
          <div style={{ color: '#e2e8f0', fontSize: 13 }}>{seg.text}</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>{seg.translation}</div>
        </div>
      ))}
    </div>
  );
}
