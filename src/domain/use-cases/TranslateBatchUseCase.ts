import type { Sentence } from '@/domain/models/Sentence';
import type { TranslationResult } from '@/domain/models/TranslationResult';
import type { IInstantTranslator } from '@/domain/ports/IInstantTranslator';
import { logger } from '@/shared/logger';
import type { VideoContext } from '@/shared/types';

interface TranslateDeps {
  /**
   * 走 Google / Bing 这种传统机翻服务。每句独立翻译，几百毫秒一句。
   * 之所以不再用 LLM 整批翻译：一个 30 分钟视频抓出来 2000+ 句，
   * 用 LLM 6 句一批一句一句翻 = 20+ 分钟，会触发我们 content 层 90s 超时。
   * 用 MT 并发 50 路：~5 秒搞定整段。
   *
   * AI 润色（去机翻味）现在挪到了 live mode + side panel，不再阻塞主流程。
   */
  instantTranslator: IInstantTranslator;
}

/** 一次性发出去的并发翻译数。Google gtx 端点对单 IP 没硬性 QPS，
 * 实测 32 路稳定不被 429。再高反而会有少量 timeout 反复重试不划算。 */
const TRANSLATE_CONCURRENCY = 32;

export class TranslateBatchUseCase {
  constructor(private readonly deps: TranslateDeps) {}

  async execute(input: {
    video: VideoContext;
    sentences: Sentence[];
    targetLanguage: string;
  }): Promise<TranslationResult[]> {
    const sentences = input.sentences;
    if (sentences.length === 0) {
      return [];
    }

    const results: TranslationResult[] = new Array(sentences.length);
    let cursor = 0;

    const sourceLanguage = input.video.sourceLanguage ?? 'auto';

    const worker = async (): Promise<void> => {
      while (true) {
        const index = cursor++;
        if (index >= sentences.length) return;
        const sentence = sentences[index];
        try {
          const translation = await this.deps.instantTranslator.translate({
            text: sentence.text,
            sourceLanguage,
            targetLanguage: input.targetLanguage,
          });
          results[index] = {
            sentenceId: sentence.id,
            translation: translation || sentence.text,
          };
        } catch (error) {
          logger.warn('Instant translate failed, falling back to source text.', error);
          results[index] = {
            sentenceId: sentence.id,
            translation: sentence.text,
          };
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(TRANSLATE_CONCURRENCY, sentences.length) }, () =>
        worker(),
      ),
    );

    return results;
  }
}
