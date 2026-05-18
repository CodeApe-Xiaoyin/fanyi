import { useMemo, useState } from 'react';
import type { AppSettings, ProviderConfig, ProviderTestResponse, ProviderType } from '@/shared/types';
import { activateProvider, deleteProvider, testProvider, upsertProvider } from '@/interface/shared-ui/settings-client';

const TYPES: Array<{ value: ProviderType; label: string }> = [
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'custom', label: 'Custom' },
];

interface Draft {
  type: ProviderType;
  id: string;
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  headersText: string;
  requestTemplate: string;
  responseExtractor: string;
}

function blankDraft(type: ProviderType = 'openai-compatible'): Draft {
  const base: Draft = { type, id: '', name: '', baseURL: '', apiKey: '', model: '', headersText: '', requestTemplate: '', responseExtractor: '' };
  if (type === 'openai-compatible') return { ...base, baseURL: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' };
  if (type === 'anthropic') return { ...base, baseURL: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-latest' };
  if (type === 'gemini') return { ...base, model: 'gemini-2.5-flash' };
  if (type === 'custom') return { ...base, headersText: '{"Content-Type":"application/json"}', requestTemplate: '{"input":"{{system}}\\n\\n{{lastUserMessage}}","messages":{{messages}}}', responseExtractor: '$.data.output_text' };
  return base;
}

function draftToProvider(d: Draft, existing: ProviderConfig[], editId: string): ProviderConfig {
  const id = editId || d.id || `provider-${Date.now()}`;
  const common = { id, name: d.name };
  switch (d.type) {
    case 'openai-compatible': return { ...common, type: 'openai-compatible', baseURL: d.baseURL, apiKey: d.apiKey, model: d.model, headers: d.headersText ? JSON.parse(d.headersText) : undefined };
    case 'anthropic': return { ...common, type: 'anthropic', baseURL: d.baseURL || undefined, apiKey: d.apiKey, model: d.model };
    case 'gemini': return { ...common, type: 'gemini', apiKey: d.apiKey, model: d.model };
    case 'custom': return { ...common, type: 'custom', baseURL: d.baseURL, method: 'POST' as const, headers: JSON.parse(d.headersText || '{}'), requestTemplate: d.requestTemplate, responseExtractor: d.responseExtractor };
  }
}

function providerToDraft(p: ProviderConfig): Draft {
  const base: Draft = { type: p.type, id: p.id, name: p.name, baseURL: '', apiKey: '', model: '', headersText: '', requestTemplate: '', responseExtractor: '' };
  if (p.type === 'openai-compatible') return { ...base, baseURL: p.baseURL, apiKey: p.apiKey, model: p.model, headersText: p.headers ? JSON.stringify(p.headers) : '' };
  if (p.type === 'anthropic') return { ...base, baseURL: p.baseURL ?? '', apiKey: p.apiKey, model: p.model };
  if (p.type === 'gemini') return { ...base, apiKey: p.apiKey, model: p.model };
  if (p.type === 'custom') return { ...base, baseURL: p.baseURL, headersText: JSON.stringify(p.headers), requestTemplate: p.requestTemplate, responseExtractor: p.responseExtractor };
  return base;
}

interface Props { settings: AppSettings; onSettingsChange: (s: AppSettings) => void; }

export function TranslationSettingsPage({ settings, onSettingsChange }: Props): JSX.Element {
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editId, setEditId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState<ProviderTestResponse | null>(null);

  const activeProvider = useMemo(() => settings.llm.providers.find((p) => p.id === settings.llm.activeProviderId), [settings]);

  const submit = async () => {
    try {
      setError(''); setSaving(true);
      const provider = draftToProvider(draft, settings.llm.providers, editId);
      const next = await upsertProvider(provider);
      onSettingsChange(next);
      setDraft(blankDraft(draft.type)); setEditId('');
    } catch (e) { setError(e instanceof Error ? e.message : '配置格式不正确。'); }
    finally { setSaving(false); }
  };

  const runTest = async (provider?: ProviderConfig) => {
    try {
      setSaving(true); setError('');
      const target = provider ?? draftToProvider(draft, settings.llm.providers, editId);
      setTestStatus(await testProvider(target));
    } catch (e) { setError(e instanceof Error ? e.message : '无法测试。'); }
    finally { setSaving(false); }
  };

  const startEdit = (p: ProviderConfig) => { setDraft(providerToDraft(p)); setEditId(p.id); setError(''); setTestStatus(null); };
  const cancelEdit = () => { setDraft(blankDraft(draft.type)); setEditId(''); setError(''); setTestStatus(null); };

  const remove = async (id: string) => {
    const next = await deleteProvider(id);
    onSettingsChange(next);
    if (id === editId) cancelEdit();
  };

  return (
    <div>
      <h1 className="sp-page-title">翻译设置</h1>

      <div className="sp-control-group" style={{ marginBottom: 16 }}>
        <div className="sp-control-group-title">已配置的 AI 模型</div>
        {settings.llm.providers.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b', padding: '8px 0' }}>尚未配置任何 AI 模型。AI 润色、总结等功能需要配置至少一个 provider。</p>
        ) : (
          <div className="sp-provider-list">
            {settings.llm.providers.map((p) => (
              <div key={p.id} className={`sp-provider-card${p.id === settings.llm.activeProviderId ? ' active' : ''}`}>
                <div className="sp-provider-info">
                  <span className="sp-provider-name">{p.name}</span>
                  <span className="sp-provider-model">{p.type} · {('model' in p) ? p.model : 'custom'}</span>
                </div>
                <div className="sp-provider-actions">
                  {p.id !== settings.llm.activeProviderId && (
                    <button className="sp-btn small" onClick={() => { void activateProvider(p.id).then(onSettingsChange); }}>激活</button>
                  )}
                  {p.id === settings.llm.activeProviderId && <span style={{ fontSize: 11, color: '#5b8def', fontWeight: 600 }}>当前激活</span>}
                  <button className="sp-btn small" onClick={() => startEdit(p)}>编辑</button>
                  <button className="sp-btn small" onClick={() => { void runTest(p); }}>测试</button>
                  <button className="sp-btn small danger" onClick={() => { void remove(p.id); }}>删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {testStatus && (
        <div className="sp-control-group" style={{ marginBottom: 16, borderColor: testStatus.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
          <div className="sp-control-group-title" style={{ color: testStatus.ok ? '#4ade80' : '#fca5a5' }}>{testStatus.ok ? '测试成功' : '测试失败'}</div>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: '#cbd5e1', margin: 0 }}>
            {testStatus.ok ? testStatus.responsePreview : testStatus.error}
          </pre>
        </div>
      )}

      <div className="sp-control-group" style={{ marginBottom: 16 }}>
        <div className="sp-control-group-title">{editId ? '编辑 Provider' : '新增 Provider'}</div>

        <div className="sp-label">
          <span>类型</span>
          <select disabled={!!editId} value={draft.type} onChange={(e) => setDraft(blankDraft(e.target.value as ProviderType))}>
            {TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
        </div>
        {editId && <div className="sp-label"><span>ID</span><span style={{ fontSize: 12, color: '#64748b' }}>{editId}</span></div>}
        <div className="sp-label">
          <span>名称</span>
          <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="My Provider" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', width: 180 }} />
        </div>
        {draft.type !== 'gemini' && (
          <div className="sp-label">
            <span>Base URL</span>
            <input type="text" value={draft.baseURL} onChange={(e) => setDraft({ ...draft, baseURL: e.target.value })} placeholder="https://api.openai.com/v1" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', width: 260 }} />
          </div>
        )}
        <div className="sp-label">
          <span>API Key</span>
          <input type="password" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="sk-..." style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', width: 240 }} />
        </div>
        <div className="sp-label">
          <span>Model</span>
          <input type="text" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="gpt-4.1-mini" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', width: 200 }} />
        </div>

        {error && <p style={{ color: '#fca5a5', fontSize: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="sp-btn primary" disabled={saving} onClick={() => { void submit(); }}>{editId ? '保存修改' : '添加 Provider'}</button>
          <button className="sp-btn" disabled={saving} onClick={() => { void runTest(); }}>测试连接</button>
          {editId && <button className="sp-btn" disabled={saving} onClick={cancelEdit}>取消</button>}
        </div>
      </div>
    </div>
  );
}
