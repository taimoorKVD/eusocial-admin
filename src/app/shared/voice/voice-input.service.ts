import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

const SHORT_ANSWER_FAST_PATH_MAX_WORDS = 3;
const SHORT_ANSWER_FAST_PATH_MAX_CHARS = 22;
const SHORT_ANSWER_FAST_PATH_GRACE_MS = 300;
const SHORT_ANSWER_FAST_PATH_PENDING_RESULTS_MAX = 1;

@Injectable()
export class VoiceInputService implements OnDestroy {
  readonly isSupported = signal(this.detectSupport());
  readonly listening = signal(false);
  readonly interimTranscript = signal('');
  readonly finalTranscript = signal('');
  readonly errorMessage = signal('');

  private readonly ngZone = inject(NgZone);

  private recognition: SpeechRecognitionLike | null = null;
  private shortAnswerStopTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.stopListening();
  }

  startListening(lang = 'en-US'): void {
    if (!this.isSupported()) {
      this.errorMessage.set('Voice input is not supported in this browser.');
      return;
    }

    this.stopListening();
    this.interimTranscript.set('');
    this.finalTranscript.set('');
    this.errorMessage.set('');

    const RecognitionCtor = this.getRecognitionConstructor();
    if (!RecognitionCtor) {
      this.isSupported.set(false);
      this.errorMessage.set('Voice input is not supported in this browser.');
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      this.ngZone.run(() => this.handleRecognitionResult(event));
    };

    recognition.onerror = (event) => {
      this.ngZone.run(() => this.handleRecognitionError(event));
    };

    recognition.onend = () => {
      this.ngZone.run(() => this.handleRecognitionEnd());
    };

    this.recognition = recognition;

    try {
      recognition.start();
      this.listening.set(true);
    } catch {
      this.errorMessage.set('Voice input unavailable. You can continue by typing.');
      this.listening.set(false);
      this.recognition = null;
    }
  }

  stopListening(): void {
    const recognition = this.recognition;
    this.recognition = null;
    this.clearShortAnswerStopTimer();

    if (!recognition) {
      this.listening.set(false);
      this.interimTranscript.set('');
      return;
    }

    try {
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        // Ignore cleanup errors.
      }
    }

    this.commitPendingTranscript();
    this.listening.set(false);
    this.interimTranscript.set('');
  }

  consumeFinalTranscript(): string {
    this.commitPendingTranscript();
    const transcript = this.finalTranscript().trim();
    this.finalTranscript.set('');
    return transcript;
  }

  private handleRecognitionResult(event: SpeechRecognitionEventLike): void {
    let finalText = '';
    let interimText = '';

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = this.readResultTranscript(result);
      if (!transcript) {
        continue;
      }

      if (result.isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }

    finalText = finalText.trim();
    interimText = interimText.trim();

    if (finalText) {
      this.finalTranscript.set(finalText);

      // Fast-path: for very short answers, don't wait for the browser's end-of-speech
      // heuristic (which can be slow under background noise). We only do this when:
      // - the onresult batch is simple (typically a single final result)
      // - the transcript "looks short"
      // - we are not currently seeing interim speech continuation
      if (
        event.results.length <= SHORT_ANSWER_FAST_PATH_PENDING_RESULTS_MAX &&
        this.shouldFastStopForShortAnswer(finalText) &&
        !interimText
      ) {
        this.scheduleShortAnswerStop();
      }
    }

    // If we see interim speech after a final, cancel any fast stop — user may be continuing.
    if (interimText) {
      this.clearShortAnswerStopTimer();
    }

    this.interimTranscript.set(interimText);
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEventLike): void {
    if (event.error === 'aborted' || event.error === 'no-speech') {
      return;
    }

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      this.errorMessage.set('Microphone permission was denied. You can continue by typing.');
    } else {
      this.errorMessage.set('Voice input unavailable. You can continue by typing.');
    }

    this.listening.set(false);
  }

  private handleRecognitionEnd(): void {
    this.commitPendingTranscript();
    this.listening.set(false);
    this.interimTranscript.set('');
    this.recognition = null;
    this.clearShortAnswerStopTimer();
  }

  private commitPendingTranscript(): void {
    const committed = this.finalTranscript().trim();
    const interim = this.interimTranscript().trim();

    if (!committed && interim) {
      this.finalTranscript.set(interim);
      return;
    }

    if (committed && interim && !committed.includes(interim)) {
      this.finalTranscript.set(`${committed} ${interim}`.trim());
    }
  }

  private readResultTranscript(result: SpeechRecognitionResultLike): string {
    const length = Math.max(result.length ?? 0, 1);
    let transcript = '';

    for (let index = 0; index < length; index += 1) {
      transcript += result[index]?.transcript ?? '';
    }

    return transcript.trim();
  }

  private detectSupport(): boolean {
    return !!this.getRecognitionConstructor();
  }

  private getRecognitionConstructor(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const browserWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
  }

  private shouldFastStopForShortAnswer(transcript: string): boolean {
    const cleaned = transcript
      .trim()
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    const words = cleaned.split(' ').filter(Boolean);
    if (!words.length) {
      return false;
    }

    // Avoid early stop for apparent continuation (common for long answers that pause mid-sentence).
    if (/\b(and|but|because|so|though|however|um|uh)\b$/.test(words[words.length - 1])) {
      return false;
    }

    if (words.length > SHORT_ANSWER_FAST_PATH_MAX_WORDS) {
      return false;
    }

    // Keep it tight so "Satisfied" / "Very satisfied" / "Ten kilograms" are fast,
    // but longer sentences (textarea-style answers) are not.
    if (cleaned.length > SHORT_ANSWER_FAST_PATH_MAX_CHARS) {
      return false;
    }

    return true;
  }

  private scheduleShortAnswerStop(): void {
    // Don't stack timers; we'll handle only one end-of-speech decision per utterance.
    if (this.shortAnswerStopTimer) {
      return;
    }

    // Small grace prevents cutting off answers when the browser emits a final slightly early.
    this.shortAnswerStopTimer = setTimeout(() => {
      this.shortAnswerStopTimer = null;
      if (!this.recognition) {
        return;
      }
      // Stop recognition so the shell can process the final transcript immediately.
      this.stopListening();
    }, SHORT_ANSWER_FAST_PATH_GRACE_MS);
  }

  private clearShortAnswerStopTimer(): void {
    if (this.shortAnswerStopTimer) {
      clearTimeout(this.shortAnswerStopTimer);
      this.shortAnswerStopTimer = null;
    }
  }
}
