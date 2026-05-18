import type { Sentence } from '@/domain/models/Sentence';
import type { Cue } from '@/domain/models/Cue';
import type { VideoContext } from '@/shared/types';

export class PromptBuilder {
  buildSegmentationPrompt(video: VideoContext, cues: Cue[]): {
    system: string;
    user: string;
  } {
    const body = cues
      .map((cue, index) => `[${index + 1}] ${cue.text}`)
      .join('\n');

    return {
      system: '你是字幕断句专家。只输出 JSON，不要解释。',
      user: [
        `视频标题：${video.title}`,
        video.channel ? `频道：${video.channel}` : '',
        '请判断以下字幕片段中哪些编号的末尾是完整句子的结束。',
        '输出格式：{"boundaries":[3,4]}',
        '',
        body,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  buildTranslationPrompt(input: {
    video: VideoContext;
    sentences: Sentence[];
    targetLanguage: string;
    previousTranslation?: string;
  }): {
    system: string;
    user: string;
  } {
    const { video, sentences, targetLanguage, previousTranslation } = input;
    const sentenceList = JSON.stringify(sentences.map((sentence) => sentence.text), null, 2);

    return {
      system: [
        '你是专业字幕翻译。',
        `目标语言：${targetLanguage}`,
        `视频标题：${video.title}`,
        video.channel ? `频道：${video.channel}` : '',
        video.currentChapter ? `章节：${video.currentChapter}` : '',
        previousTranslation ? `上一句译文：${previousTranslation}` : '',
        '保持简洁、自然、口语化，不要增删含义。',
        '只输出 JSON 对象，格式为 {"translations":["..."]}',
      ]
        .filter(Boolean)
        .join('\n'),
      user: sentenceList,
    };
  }
}
