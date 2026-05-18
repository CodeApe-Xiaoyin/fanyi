import { useEffect, useState } from 'react';

import { clearDebugLogs, getDebugLogs } from '@/interface/shared-ui/settings-client';
import type { DebugLogEntry } from '@/shared/types';

export function DebugPage(): JSX.Element {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      const next = await getDebugLogs();
      setLogs(next.slice().reverse());
    } finally {
      setLoading(false);
    }
  };

  const clear = async (): Promise<void> => {
    setLoading(true);
    try {
      await clearDebugLogs();
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Debug</p>
          <h2>本地调试日志</h2>
          <p className="muted">这里会显示抓字幕、发请求、结果结构检查等阶段日志。</p>
        </div>
      </div>

      <div className="actions-inline">
        <button className="secondary-button" disabled={loading} onClick={() => void refresh()} type="button">
          刷新日志
        </button>
        <button className="ghost-button" disabled={loading} onClick={() => void clear()} type="button">
          清空日志
        </button>
      </div>

      <div className="content-card stack-sm">
        {logs.length === 0 ? <p className="muted">当前还没有日志。</p> : null}
        {logs.map((log) => (
          <div className="debug-log-row" key={log.id}>
            <div className="debug-log-meta">
              <strong>{log.event}</strong>
              <span>{formatLogTime(log.timestamp)}</span>
              <span>{log.source}</span>
              <span>{log.level}</span>
            </div>
            <pre className="debug-log-details">{log.details ?? ''}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
}
