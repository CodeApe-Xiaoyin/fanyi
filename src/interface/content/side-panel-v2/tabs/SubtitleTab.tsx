import { useEffect, useMemo, useRef, useState } from 'react';
import type { BilingualCue } from '@/domain/models/Cue';
import { useVideoTime } from '../use-video-time';

interface Props {
  cues: BilingualCue[];
  video: HTMLVideoElement;
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
  translation: string;
  text: string;
}

function groupBySentence(cues: BilingualCue[]): SentenceGroup[] {
  const map = new Map<string, SentenceGroup>();
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
        translation: cue.translation,
        text: cue.text,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

export function SubtitleTab({ cues, video }: Props): JSX.Element {
  const [search, setSearch] = useState('');
  const currentTime = useVideoTime(video);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupBySentence(cues), [cues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.text.toLowerCase().includes(q) || g.translation.includes(q));
  }, [groups, search]);

  const activeId = useMemo(() => {
    const g = groups.find((g) => currentTime >= g.start && currentTime <= g.end);
    return g?.sentenceId ?? '';
  }, [groups, currentTime]);

  useEffect(() => {
    if (!listRef.current || !activeId) return;
    const el = listRef.current.querySelector(`[data-sid="${CSS.escape(activeId)}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  return (
    <div>
      <input
        className="sp2-search"
        type="text"
        placeholder="搜索字幕..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="sp2-list" ref={listRef}>
        {filtered.length === 0 ? (
          <div className="sp2-empty">{search ? '没有匹配结果' : '暂无字幕数据'}</div>
        ) : (
          filtered.map((g) => (
            <button
              key={g.sentenceId}
              type="button"
              data-sid={g.sentenceId}
              className={`sp2-cue${g.sentenceId === activeId ? ' active' : ''}`}
              onClick={() => { video.currentTime = g.start; }}
            >
              <span className="sp2-cue-time">{fmtTime(g.start)}</span>
              <div>
                <div className="sp2-cue-tl">{g.translation}</div>
                <div className="sp2-cue-en">{g.text}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
