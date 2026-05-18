import type { ChatRequest } from '@/domain/ports/ILLMProvider';

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function buildEndpoint(baseURL: string, path: string): string {
  const trimmed = baseURL.replace(/\/$/, '');
  return trimmed.endsWith(path) ? trimmed : `${trimmed}${path}`;
}

export function normalizeModelPath(model: string): string {
  return model.startsWith('models/') ? model : `models/${model}`;
}

export function renderTemplate(
  template: string,
  request: ChatRequest,
  model: string,
): string {
  const replacements: Record<string, string> = {
    system: escapeStringForJsonTemplate(request.system ?? ''),
    lastUserMessage: escapeStringForJsonTemplate(
      request.messages.filter((message) => message.role === 'user').at(-1)?.content ?? '',
    ),
    model: escapeStringForJsonTemplate(model),
    temperature: String(request.temperature ?? 0.2),
    maxTokens: String(request.maxTokens ?? ''),
    messages: JSON.stringify(request.messages),
    metadata: JSON.stringify(request.metadata ?? {}),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => replacements[key] ?? '');
}

export function extractJsonPath(input: unknown, path: string): unknown {
  if (path.trim() === '$') {
    return input;
  }

  if (!path.startsWith('$')) {
    return undefined;
  }

  const tokens = tokenizePath(path);
  let current: unknown = input;

  for (const token of tokens) {
    if (typeof token === 'number') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[token];
      continue;
    }

    if (typeof current !== 'object' || current === null || !(token in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[token];
  }

  return current;
}

export function unknownToText(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => unknownToText(item)).join('');
  }

  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input === 'object') {
    return JSON.stringify(input);
  }

  return String(input);
}

export async function parseJsonResponse<T>(
  response: Response,
  label: string,
): Promise<{ payload: T; rawText: string }> {
  const rawText = await response.text();
  if (!rawText.trim()) {
    throw new Error(`${label} 返回了空响应体。`);
  }

  const payload = safeJsonParse(rawText) as T | undefined;
  if (!payload) {
    throw new Error(`${label} 返回的不是合法 JSON：${rawText.slice(0, 160)}`);
  }

  return { payload, rawText };
}

function tokenizePath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const matcher = /\.([A-Za-z0-9_-]+)|\[(\d+)\]/g;

  for (const match of path.matchAll(matcher)) {
    if (match[1]) {
      tokens.push(match[1]);
    } else if (match[2]) {
      tokens.push(Number(match[2]));
    }
  }

  return tokens;
}

function escapeStringForJsonTemplate(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}
