import { useMemo, useState } from 'react';
import type { BilingualCue } from '@/domain/models/Cue';
import type { AppSettings } from '@/shared/types';

interface Props {
  cues: BilingualCue[];
  video: HTMLVideoElement;
  settings: AppSettings;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface SentenceGroup {
  sentenceId: string;
  start: number;
  end: number;
  text: string;
  translation: string;
}

function groupSentences(cues: BilingualCue[]): SentenceGroup[] {
  const map = new Map<string, SentenceGroup>();
  for (const cue of cues) {
    const g = map.get(cue.sentenceId);
    if (g) {
      g.end = Math.max(g.end, cue.end);
      g.text += ' ' + cue.text;
    } else {
      map.set(cue.sentenceId, { sentenceId: cue.sentenceId, start: cue.start, end: cue.end, text: cue.text, translation: cue.translation });
    }
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

export function SegmentsTab({ cues, video }: Props): JSX.Element {
  const groups = useMemo(() => groupSentences(cues), [cues]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [screenshot, setScreenshot] = useState<string | null>(null);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const captureScreenshot = () => {
    const selIds = selected.size > 0 ? selected : new Set(groups.map((g) => g.sentenceId));
    const startTime = groups.find((g) => selIds.has(g.sentenceId))?.start ?? video.currentTime;

    video.currentTime = startTime;
    video.pause();

    requestAnimationFrame(() => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const fontSize = Math.round(canvas.height * 0.04);
        const match = groups.find((g) => selIds.has(g.sentenceId));
        if (match) {
          ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          ctx.lineWidth = 2;
          const y = canvas.height * 0.85;
          ctx.strokeText(match.translation, canvas.width / 2, y);
          ctx.fillText(match.translation, canvas.width / 2, y);
        }

        setScreenshot(canvas.toDataURL('image/png'));
      } catch {
        setScreenshot(null);
        alert('截图失败：视频可能受版权保护。');
      }
    });
  };

  const exportLongImage = () => {
    if (!screenshot) return;
    const a = document.createElement('a');
    a.href = screenshot;
    a.download = `fanyi-screenshot-${Date.now()}.png`;
    a.click();
  };

  return (
    <div>
      {groups.length === 0 ? (
        <div className="sp2-empty">暂无字幕数据，无法生成片段</div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            选择要截图的句子，跳转到对应时间点生成截图
          </p>
          <div className="sp2-segment-select">
            {groups.slice(0, 50).map((g) => (
              <div
                key={g.sentenceId}
                className={`sp2-segment-row${selected.has(g.sentenceId) ? ' selected' : ''}`}
                onClick={() => toggle(g.sentenceId)}
              >
                <input type="checkbox" checked={selected.has(g.sentenceId)} onChange={() => {}} style={{ accentColor: '#5b8def' }} />
                <span className="sp2-cue-time">{fmtTime(g.start)}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.translation}</span>
              </div>
            ))}
          </div>
          <div className="sp2-btn-row">
            <button className="sp2-btn primary" onClick={captureScreenshot}>
              生成截图
            </button>
          </div>
          {screenshot && (
            <div style={{ marginTop: 12 }}>
              <div className="sp2-screenshot-preview">
                <img src={screenshot} alt="字幕截图预览" />
              </div>
              <div className="sp2-btn-row" style={{ marginTop: 8 }}>
                <button className="sp2-btn" onClick={exportLongImage}>
                  导出长图
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
