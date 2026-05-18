import type { Cue } from '@/domain/models/Cue';
import type { Sentence } from '@/domain/models/Sentence';
import type { SentenceReconstructor } from '@/domain/services/SentenceReconstructor';
import type { VideoContext } from '@/shared/types';

interface SegmentationDeps {
  reconstructor: SentenceReconstructor;
}

/**
 * 把 YouTube cue 数组拼回成完整句子。
 *
 * 之前：先让 LLM 帮忙找句界，失败再走 heuristic。
 * 现实：长视频抓出来 2000+ 个 cue，把它们整段塞 LLM 既慢又不一定回得来；
 * heuristic（句末标点 / 长度 / 停顿）对 ASR 字幕已经够用。
 * LLM 断句留作未来"高质量模式"的扩展点，主流程不再依赖。
 */
export class SmartSegmentationUseCase {
  constructor(private readonly deps: SegmentationDeps) {}

  async execute(_video: VideoContext, cues: Cue[]): Promise<Sentence[]> {
    const boundaries = this.deps.reconstructor.inferBoundaries(cues);
    return this.deps.reconstructor.fromBoundaries(cues, boundaries);
  }
}
