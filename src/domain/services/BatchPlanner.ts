import type { Sentence } from '@/domain/models/Sentence';

export class BatchPlanner {
  plan(sentences: Sentence[], batchSize = 6): Sentence[][] {
    const batches: Sentence[][] = [];

    for (let index = 0; index < sentences.length; index += batchSize) {
      batches.push(sentences.slice(index, index + batchSize));
    }

    return batches;
  }
}
