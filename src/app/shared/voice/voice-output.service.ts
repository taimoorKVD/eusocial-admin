import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';

/**
 * Browser SpeechSynthesis wrapper.
 * `speak()` resolves when the utterance ends, errors, or is cancelled —
 * callers can safely `await` before starting SpeechRecognition.
 */
@Injectable()
export class VoiceOutputService implements OnDestroy {
  readonly isSupported = signal(this.detectSupport());
  readonly speaking = signal(false);
  readonly errorMessage = signal('');

  private readonly ngZone = inject(NgZone);
  private utterance: SpeechSynthesisUtterance | null = null;
  private speakToken = 0;
  private pendingResolve: (() => void) | null = null;
  private chromeKeepAliveTimer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    this.stop();
  }

  speak(text: string, lang = 'en-US'): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return Promise.resolve();
    }

    if (!this.isSupported()) {
      this.errorMessage.set('Text-to-speech is not supported in this browser.');
      return Promise.resolve();
    }

    // Cancel any prior utterance and settle its promise.
    this.stop();
    this.errorMessage.set('');

    const token = ++this.speakToken;
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.pitch = 1;
    this.utterance = utterance;

    return new Promise<void>((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        this.clearChromeKeepAlive();

        this.ngZone.run(() => {
          if (token === this.speakToken) {
            this.speaking.set(false);
            this.utterance = null;
          }
          if (this.pendingResolve === resolve) {
            this.pendingResolve = null;
          }
          resolve();
        });
      };

      this.pendingResolve = finish;

      utterance.onstart = () => {
        this.ngZone.run(() => {
          if (token === this.speakToken) {
            this.speaking.set(true);
          }
        });
      };

      utterance.onend = () => finish();
      utterance.onerror = (event) => {
        this.ngZone.run(() => {
          const err = String((event as SpeechSynthesisErrorEvent)?.error || '');
          if (err && err !== 'interrupted' && err !== 'canceled') {
            this.errorMessage.set('Unable to read this question aloud.');
          }
        });
        finish();
      };

      try {
        // Chrome can leave synthesis paused after cancel(); resume before speak.
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
        this.startChromeKeepAlive();
      } catch {
        this.ngZone.run(() => {
          this.errorMessage.set('Unable to read this question aloud.');
          this.speaking.set(false);
          this.utterance = null;
        });
        finish();
      }
    });
  }

  stop(): void {
    this.speakToken += 1;
    this.clearChromeKeepAlive();
    this.utterance = null;
    this.speaking.set(false);

    const pending = this.pendingResolve;
    this.pendingResolve = null;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cleanup errors.
      }
    }

    // Always settle the awaiting caller so TTS → listen chaining cannot hang.
    if (pending) {
      this.ngZone.run(() => pending());
    }
  }

  private startChromeKeepAlive(): void {
    this.clearChromeKeepAlive();
    // Chrome bug: long utterances can freeze unless resume() is called periodically.
    this.chromeKeepAliveTimer = setInterval(() => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        return;
      }
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 5000);
  }

  private clearChromeKeepAlive(): void {
    if (this.chromeKeepAliveTimer) {
      clearInterval(this.chromeKeepAliveTimer);
      this.chromeKeepAliveTimer = null;
    }
  }

  private detectSupport(): boolean {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  }
}
