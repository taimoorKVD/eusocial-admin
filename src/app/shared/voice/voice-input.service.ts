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

@Injectable()
export class VoiceInputService implements OnDestroy {
  readonly isSupported = signal(this.detectSupport());
  readonly listening = signal(false);
  readonly interimTranscript = signal('');
  readonly finalTranscript = signal('');
  readonly errorMessage = signal('');

  private readonly ngZone = inject(NgZone);

  private recognition: SpeechRecognitionLike | null = null;

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
}
