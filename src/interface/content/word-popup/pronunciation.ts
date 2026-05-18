let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, lang = 'en-US'): void {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  currentUtterance = utterance;
  utterance.onend = () => { currentUtterance = null; };
  utterance.onerror = () => { currentUtterance = null; };
  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  speechSynthesis.cancel();
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return currentUtterance !== null;
}
