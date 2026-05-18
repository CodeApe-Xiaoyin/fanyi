import type { IInstantTranslator } from '@/domain/ports/IInstantTranslator';

/**
 * 使用 Google Translate 公开网页端点（client=gtx）做实时翻译。
 *
 * 这是 Google Translate 网页版自己用的接口，不需要 API key，
 * 也不需要登录态。响应一般 < 500ms。
 *
 * 返回结构示例 (q="hello world"):
 * [
 *   [["你好世界","hello world",null,null,1]],
 *   null,
 *   "en"
 * ]
 */
export class GoogleInstantTranslator implements IInstantTranslator {
  readonly id = 'google-gtx';

  async translate(input: {
    text: string;
    sourceLanguage?: string;
    targetLanguage: string;
  }): Promise<string> {
    const text = input.text.trim();
    if (!text) return '';

    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', normalizeLanguage(input.sourceLanguage) || 'auto');
    url.searchParams.set('tl', normalizeLanguage(input.targetLanguage));
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);

    const response = await fetch(url.toString(), {
      // Google 的 gtx 端点不需要登录状态，反而带着 cookie 偶尔会触发反爬，
      // 显式 omit 掉。
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`Google translate HTTP ${response.status}`);
    }

    const data = (await response.json()) as unknown;
    return extractTranslation(data);
  }
}

function extractTranslation(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const sentences = data[0];
  if (!Array.isArray(sentences)) {
    return '';
  }

  return sentences
    .map((row) => (Array.isArray(row) && typeof row[0] === 'string' ? row[0] : ''))
    .join('')
    .trim();
}

/**
 * Google Translate 的语言代码：zh-CN / zh-TW，部分语言只接受简码。
 * 我们只关心常见情况，其余直接透传。
 */
function normalizeLanguage(input: string | undefined): string {
  if (!input) return '';
  const lower = input.toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans') return 'zh-CN';
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-hant') return 'zh-TW';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  return input;
}
