import { Injectable, OnDestroy, signal } from '@angular/core';

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

  private recognition: SpeechRecognitionLike | null = null;
  private shouldRestart = false;

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
      let interim = '';
      let finalText = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      this.interimTranscript.set(interim.trim());
      if (finalText.trim()) {
        this.finalTranscript.set(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.errorMessage.set('Microphone permission was denied. You can continue by typing.');
      } else {
        this.errorMessage.set('Voice input unavailable. You can continue by typing.');
      }

      this.listening.set(false);
    };

    recognition.onend = () => {
      this.listening.set(false);
      this.interimTranscript.set('');
      this.recognition = null;
    };

    this.recognition = recognition;
    this.shouldRestart = false;

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
    this.shouldRestart = false;
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

    this.listening.set(false);
    this.interimTranscript.set('');
  }

  consumeFinalTranscript(): string {
    const transcript = this.finalTranscript();
    this.finalTranscript.set('');
    return transcript;
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
