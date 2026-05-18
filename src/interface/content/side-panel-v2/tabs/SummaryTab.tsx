import { useState } from 'react';
import type { BilingualCue } from '@/domain/models/Cue';
import type { AppSettings, VideoContext } from '@/shared/types';

interface Props {
  cues: BilingualCue[];
  settings: AppSettings;
  videoContext: VideoContext;
}

export function SummaryTab({ cues, settings }: Props): JSX.Element {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasProvider = settings.llm.providers.length > 0 && settings.llm.activeProviderId;

  const generateSummary = async (deepThink = false) => {
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const text = cues.map((c) => c.text).filter(Boolean).slice(0, 500).join('\n');
      const response = await new Promise<string>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'fanyi/ai-summarize', payload: { video: { videoId: '', title: '' }, subtitleText: text, deepThink } },
          (res) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (res.ok) resolve(res.summary);
            else reject(new Error(res.error));
          },
        );
      });
      setSummary(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sp2-summary-area">
      {!hasProvider ? (
        <div className="sp2-empty">请先在翻译设置中配置 AI 模型，即可使用 AI 总结功能。</div>
      ) : loading ? (
        <div className="sp2-summary-loading">
          <div className="sp2-spinner" />
          <span>正在生成总结...</span>
        </div>
      ) : summary ? (
        <>
          <div className="sp2-summary-result">{summary}</div>
          <div className="sp2-btn-row">
            <button className="sp2-btn" onClick={() => { void navigator.clipboard.writeText(summary); }}>
              复制总结
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sp2-empty">使用 AI 生成视频内容总结</div>
          <div className="sp2-btn-row">
            <button className="sp2-btn primary" onClick={() => { void generateSummary(false); }}>
              生成总结
            </button>
            <button className="sp2-btn" onClick={() => { void generateSummary(true); }}>
              深度思考
            </button>
          </div>
          {error && <div style={{ color: '#fca5a5', fontSize: 12 }}>{error}</div>}
        </>
      )}
    </div>
  );
}
