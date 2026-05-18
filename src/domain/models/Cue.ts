export interface Cue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface BilingualCue extends Cue {
  translation: string;
  sentenceId: string;
  wordTimings: WordTiming[];
  translationSource?: 'google' | 'ai-polished' | 'live-ai';
}
