import { useEffect, useState } from 'react';
import type { AppSettings, CacheState } from '@/shared/types';
import { clearCache, getCacheState } from '@/interface/shared-ui/settings-client';

interface Props {
  settings: AppSettings;
}

export function AccessibilityPage({ settings }: Props): JSX.Element {
  const [cacheState, setCacheState] = useState<CacheState | null>(null);

  useEffect(() => { void getCacheState().then(setCacheState); }, []);

  const handleClearCache = async () => {
    const next = await clearCache();
    setCacheState(next);
  };

  return (
    <div>
      <h1 className="sp-page-title">辅助功能</h1>

      <div className="sp-control-group" style={{ marginBottom: 16 }}>
        <div className="sp-control-group-title">缓存管理</div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
          当前缓存条目：{cacheState?.count ?? '...'}
        </p>
        <p style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
          切换 provider、模型或字幕策略后，如果结果看起来不对，先清缓存再重试会更稳。
        </p>
        {cacheState && cacheState.entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, maxHeight: 200, overflow: 'auto' }}>
            {cacheState.entries.map((entry) => (
              <div key={entry.cacheKey} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', fontSize: 12 }}>
                <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{entry.cacheKey}</span>
                <span style={{ color: '#64748b' }}>{new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
              </div>
            ))}
          </div>
        )}
        <button className="sp-btn danger" onClick={() => { void handleClearCache(); }}>清空字幕缓存</button>
      </div>

      <div className="sp-control-group" style={{ marginBottom: 16 }}>
        <div className="sp-control-group-title">扩展信息</div>
        <div className="sp-feedback-item">
          <span className="sp-feedback-label">扩展版本</span>
          <span className="sp-feedback-value">0.1.0</span>
        </div>
        <div className="sp-feedback-item">
          <span className="sp-feedback-label">目标语言</span>
          <span className="sp-feedback-value">{settings.targetLanguage}</span>
        </div>
        <div className="sp-feedback-item">
          <span className="sp-feedback-label">AI Provider</span>
          <span className="sp-feedback-value">
            {settings.llm.providers.find((p) => p.id === settings.llm.activeProviderId)?.name ?? '未配置'}
          </span>
        </div>
      </div>
    </div>
  );
}
