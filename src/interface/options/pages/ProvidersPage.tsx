import { useMemo, useState } from 'react';

import {
  activateProvider,
  deleteProvider,
  testProvider,
  upsertProvider,
} from '@/interface/shared-ui/settings-client';
import type {
  AppSettings,
  ProviderConfig,
  ProviderTestResponse,
  ProviderType,
} from '@/shared/types';

interface Props {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

interface ProviderDraftForm {
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

const providerTypeOptions: Array<{ value: ProviderType; label: string }> = [
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'custom', label: 'Custom Template' },
];

function createDraft(
  type: ProviderType = 'openai-compatible',
): ProviderDraftForm {
  switch (type) {
    case 'openai-compatible':
      return {
        type,
        id: '',
        name: '',
        baseURL: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4.1-mini',
        headersText: '',
        requestTemplate: '',
        responseExtractor: '',
      };
    case 'anthropic':
      return {
        type,
        id: '',
        name: '',
        baseURL: 'https://api.anthropic.com',
        apiKey: '',
        model: 'claude-3-5-sonnet-latest',
        headersText: '',
        requestTemplate: '',
        responseExtractor: '',
      };
    case 'gemini':
      return {
        type,
        id: '',
        name: '',
        baseURL: '',
        apiKey: '',
        model: 'gemini-2.5-flash',
        headersText: '',
        requestTemplate: '',
        responseExtractor: '',
      };
    case 'custom':
      return {
        type,
        id: '',
        name: '',
        baseURL: '',
        apiKey: '',
        model: '',
        headersText: '{\n  "Content-Type": "application/json"\n}',
        requestTemplate:
          '{\n  "input": "{{system}}\\n\\n{{lastUserMessage}}",\n  "messages": {{messages}}\n}',
        responseExtractor: '$.data.output_text',
      };
  }
}

export function ProvidersPage({
  settings,
  onSettingsChange,
}: Props): JSX.Element {
  const [draft, setDraft] = useState<ProviderDraftForm>(createDraft());
  const [editingProviderId, setEditingProviderId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [testStatus, setTestStatus] = useState<ProviderTestResponse | null>(
    null,
  );
  const activeProvider = useMemo(
    () =>
      settings.llm.providers.find(
        (item) => item.id === settings.llm.activeProviderId,
      ),
    [settings],
  );

  const submit = async (): Promise<void> => {
    try {
      const provider = draftToProvider(
        draft,
        settings.llm.providers,
        editingProviderId,
      );
      setError('');
      setSaving(true);
      const next = await upsertProvider(provider);
      onSettingsChange(next);
      setDraft(createDraft(draft.type));
      setEditingProviderId('');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Provider 配置格式不正确。',
      );
    } finally {
      setSaving(false);
    }
  };

  const runDraftTest = async (): Promise<void> => {
    try {
      const provider = draftToProvider(
        draft,
        settings.llm.providers,
        editingProviderId,
      );
      setSaving(true);
      setError('');
      setTestStatus(await testProvider(provider));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : '无法测试当前草稿配置。',
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (provider: ProviderConfig): void => {
    setDraft(providerToDraft(provider));
    setEditingProviderId(provider.id);
    setError('');
    setTestStatus(null);
  };

  const cancelEdit = (): void => {
    setDraft(createDraft(draft.type));
    setEditingProviderId('');
    setError('');
    setTestStatus(null);
  };

  const runSavedProviderTest = async (
    provider: ProviderConfig,
  ): Promise<void> => {
    setSaving(true);
    try {
      setTestStatus(await testProvider(provider));
    } finally {
      setSaving(false);
    }
  };

  const removeProvider = async (providerId: string): Promise<void> => {
    const next = await deleteProvider(providerId);
    onSettingsChange(next);

    if (providerId === editingProviderId) {
      cancelEdit();
    }
  };

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <div>
          <p className="eyebrow">LLM Providers</p>
          <h2>多厂商接入入口</h2>
          <p className="muted">
            当前激活：
            {activeProvider?.name ?? '未配置'}
            {activeProvider ? ` · ${activeProvider.type}` : ''}
          </p>
        </div>
      </div>

      <div className="content-card stack-md">
        <div className="section-heading-row">
          <div>
            <h3>{editingProviderId ? '编辑 Provider' : '新增 Provider'}</h3>
            <p className="section-hint">
              {editingProviderId
                ? '正在修改已有接入，保存后会覆盖原配置。'
                : '添加一个新的模型接入，保存后可在 popup 顶部切换。'}
            </p>
          </div>
          {editingProviderId ? (
            <button
              className="secondary-button compact"
              disabled={saving}
              onClick={cancelEdit}
              type="button"
            >
              取消编辑
            </button>
          ) : null}
        </div>
        <div className="form-grid">
          <label>
            <span>类型</span>
            <select
              disabled={Boolean(editingProviderId)}
              value={draft.type}
              onChange={(event) =>
                setDraft(createDraft(event.target.value as ProviderType))
              }
            >
              {providerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              {editingProviderId
                ? 'ID（编辑时保持不变）'
                : 'ID（可选，重复会自动编号）'}
            </span>
            <input
              disabled={Boolean(editingProviderId)}
              value={draft.id}
              placeholder="留空则按名称自动生成"
              onChange={(event) =>
                setDraft({ ...draft, id: event.target.value })
              }
            />
          </label>
          <label>
            <span>名称</span>
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
          {(draft.type === 'openai-compatible' ||
            draft.type === 'anthropic' ||
            draft.type === 'custom') && (
            <label className="full-span">
              <span>Base URL</span>
              <input
                value={draft.baseURL}
                onChange={(event) =>
                  setDraft({ ...draft, baseURL: event.target.value })
                }
              />
            </label>
          )}
          {draft.type !== 'custom' && (
            <label className="full-span">
              <span>API Key</span>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(event) =>
                  setDraft({ ...draft, apiKey: event.target.value })
                }
              />
            </label>
          )}
          {draft.type !== 'custom' && (
            <label className="full-span">
              <span>Model</span>
              <input
                value={draft.model}
                onChange={(event) =>
                  setDraft({ ...draft, model: event.target.value })
                }
              />
            </label>
          )}
          {draft.type === 'openai-compatible' && (
            <label className="full-span">
              <span>额外请求头 JSON（可选）</span>
              <textarea
                rows={5}
                value={draft.headersText}
                onChange={(event) =>
                  setDraft({ ...draft, headersText: event.target.value })
                }
                placeholder='{"HTTP-Referer":"https://example.com"}'
              />
            </label>
          )}
          {draft.type === 'custom' && (
            <>
              <label className="full-span">
                <span>Headers JSON</span>
                <textarea
                  rows={6}
                  value={draft.headersText}
                  onChange={(event) =>
                    setDraft({ ...draft, headersText: event.target.value })
                  }
                />
              </label>
              <label className="full-span">
                <span>Request Template</span>
                <textarea
                  rows={8}
                  value={draft.requestTemplate}
                  onChange={(event) =>
                    setDraft({ ...draft, requestTemplate: event.target.value })
                  }
                />
              </label>
              <label className="full-span">
                <span>Response Extractor</span>
                <input
                  value={draft.responseExtractor}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      responseExtractor: event.target.value,
                    })
                  }
                  placeholder="$.data.output_text"
                />
              </label>
            </>
          )}
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {testStatus ? (
          <p className={testStatus.ok ? 'success-text' : 'error-text'}>
            {testStatus.ok
              ? `连通成功：${testStatus.responsePreview}`
              : `连通失败：${testStatus.error}`}
          </p>
        ) : null}

        <div className="actions-inline">
          <button
            className="primary-button"
            disabled={saving}
            onClick={() => void submit()}
            type="button"
          >
            {editingProviderId ? '保存修改' : '保存 Provider'}
          </button>
          <button
            className="secondary-button"
            disabled={saving}
            onClick={() => void runDraftTest()}
            type="button"
          >
            测试当前草稿
          </button>
        </div>
      </div>

      <div className="content-card stack-md">
        <h3>已保存的 Provider</h3>
        {settings.llm.providers.length === 0 ? (
          <p className="muted">还没有任何 provider。</p>
        ) : null}
        <div className="stack-sm">
          {settings.llm.providers.map((provider) => (
            <div
              className={
                provider.id === editingProviderId
                  ? 'provider-row editing'
                  : 'provider-row'
              }
              key={provider.id}
            >
              <div>
                <strong>{provider.name}</strong>
                <p className="muted">
                  {provider.type}
                  {'model' in provider && provider.model
                    ? ` · ${provider.model}`
                    : ''}
                </p>
              </div>
              <div className="actions-inline">
                <button
                  className="secondary-button compact"
                  onClick={() =>
                    void activateProvider(provider.id).then(onSettingsChange)
                  }
                  type="button"
                >
                  {provider.id === settings.llm.activeProviderId
                    ? '使用中'
                    : '设为激活'}
                </button>
                <button
                  className="secondary-button compact"
                  onClick={() => void runSavedProviderTest(provider)}
                  type="button"
                >
                  测试
                </button>
                <button
                  className="secondary-button compact"
                  onClick={() => startEdit(provider)}
                  type="button"
                >
                  编辑
                </button>
                <button
                  className="ghost-button compact"
                  onClick={() => void removeProvider(provider.id)}
                  type="button"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function draftToProvider(
  draft: ProviderDraftForm,
  existingProviders: ProviderConfig[],
  editingProviderId = '',
): ProviderConfig {
  if (!draft.name) {
    throw new Error('请至少填写 Provider 的名称。');
  }

  const id =
    editingProviderId ||
    createUniqueProviderId(
      draft.id || draft.name || draft.model || draft.type,
      existingProviders.map((provider) => provider.id),
    );

  switch (draft.type) {
    case 'openai-compatible':
      if (!draft.baseURL || !draft.apiKey || !draft.model) {
        throw new Error(
          'OpenAI Compatible Provider 需要 baseURL、apiKey 和 model。',
        );
      }

      return {
        type: draft.type,
        id,
        name: draft.name,
        baseURL: draft.baseURL,
        apiKey: draft.apiKey,
        model: draft.model,
        headers: draft.headersText.trim()
          ? parseHeadersJson(draft.headersText)
          : undefined,
      };
    case 'anthropic':
      if (!draft.apiKey || !draft.model) {
        throw new Error('Anthropic Provider 需要 apiKey 和 model。');
      }

      return {
        type: draft.type,
        id,
        name: draft.name,
        baseURL: draft.baseURL.trim() || undefined,
        apiKey: draft.apiKey,
        model: draft.model,
      };
    case 'gemini':
      if (!draft.apiKey || !draft.model) {
        throw new Error('Gemini Provider 需要 apiKey 和 model。');
      }

      return {
        type: draft.type,
        id,
        name: draft.name,
        apiKey: draft.apiKey,
        model: draft.model,
      };
    case 'custom':
      if (
        !draft.baseURL ||
        !draft.headersText.trim() ||
        !draft.requestTemplate.trim() ||
        !draft.responseExtractor.trim()
      ) {
        throw new Error(
          'Custom Template Provider 需要 baseURL、headers、requestTemplate 和 responseExtractor。',
        );
      }

      return {
        type: draft.type,
        id,
        name: draft.name,
        baseURL: draft.baseURL,
        method: 'POST',
        headers: parseHeadersJson(draft.headersText),
        requestTemplate: draft.requestTemplate,
        responseExtractor: draft.responseExtractor,
      };
  }
}

function providerToDraft(provider: ProviderConfig): ProviderDraftForm {
  switch (provider.type) {
    case 'openai-compatible':
      return {
        type: provider.type,
        id: provider.id,
        name: provider.name,
        baseURL: provider.baseURL,
        apiKey: provider.apiKey,
        model: provider.model,
        headersText: provider.headers
          ? JSON.stringify(provider.headers, null, 2)
          : '',
        requestTemplate: '',
        responseExtractor: '',
      };
    case 'anthropic':
      return {
        type: provider.type,
        id: provider.id,
        name: provider.name,
        baseURL: provider.baseURL ?? 'https://api.anthropic.com',
        apiKey: provider.apiKey,
        model: provider.model,
        headersText: '',
        requestTemplate: '',
        responseExtractor: '',
      };
    case 'gemini':
      return {
        type: provider.type,
        id: provider.id,
        name: provider.name,
        baseURL: '',
        apiKey: provider.apiKey,
        model: provider.model,
        headersText: '',
        requestTemplate: '',
        responseExtractor: '',
      };
    case 'custom':
      return {
        type: provider.type,
        id: provider.id,
        name: provider.name,
        baseURL: provider.baseURL,
        apiKey: '',
        model: '',
        headersText: JSON.stringify(provider.headers, null, 2),
        requestTemplate: provider.requestTemplate,
        responseExtractor: provider.responseExtractor,
      };
  }
}

function createUniqueProviderId(seed: string, existingIds: string[]): string {
  const fallback = `provider-${Date.now().toString(36)}`;
  const base =
    seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback;
  const taken = new Set(existingIds);

  if (!taken.has(base)) {
    return base;
  }

  let index = 2;
  while (taken.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function parseHeadersJson(text: string): Record<string, string> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Headers JSON 解析失败，请检查逗号和引号。');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers JSON 必须是对象。');
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, String(value)]),
  );
}
