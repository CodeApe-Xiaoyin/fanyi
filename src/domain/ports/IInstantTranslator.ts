/**
 * 低延迟机器翻译接口。
 *
 * 与 ILLMProvider 的关系：ILLMProvider 走 LLM，质量高但延迟 1–3 秒；
 * IInstantTranslator 走传统 MT（Google / Bing / DeepL 免费端点），
 * 通常 200–500 毫秒返回。在实时翻译模式下用作"先垫一层"的草稿，
 * 等 LLM 润色完再覆盖。
 */
export interface IInstantTranslator {
  readonly id: string;

  translate(input: {
    text: string;
    sourceLanguage?: string;
    targetLanguage: string;
  }): Promise<string>;
}
