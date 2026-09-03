import { Injectable } from '@angular/core';
import { DynamicFieldType } from '../../interfaces/dynamic-field';

export type VoiceCommandType = 'next' | 'previous' | 'repeat' | 'skip' | 'startOver';

export interface VoiceCommandResult {
  isCommand: boolean;
  command?: VoiceCommandType;
  normalizedTranscript: string;
}

export interface VoiceCommandContext {
  fieldType?: DynamicFieldType | string;
}

/**
 * Field-aware voice command / intent detection.
 * Prefers structured navigation phrases over naive includes('next').
 */
@Injectable({ providedIn: 'root' })
export class VoiceCommandService {
  detect(transcript: string, context: VoiceCommandContext = {}): VoiceCommandResult {
    const normalizedTranscript = normalizeCommandText(transcript);

    if (!normalizedTranscript) {
      return { isCommand: false, normalizedTranscript };
    }

    // Content that clearly embeds "next" as part of an answer, not navigation.
    if (looksLikeContentWithIncidentalKeywords(normalizedTranscript)) {
      return { isCommand: false, normalizedTranscript };
    }

    const stripped = stripPoliteFillers(normalizedTranscript);
    const wordCount = stripped.split(' ').filter(Boolean).length;
    const fieldType = context.fieldType ?? '';

    // Long free-text answers are rarely navigation unless they match a strong pattern.
    if (isFreeTextField(fieldType) && wordCount > 10 && !hasStrongNavigationCue(stripped)) {
      return { isCommand: false, normalizedTranscript };
    }

    const command =
      matchRepeat(stripped) ??
      matchPrevious(stripped) ??
      matchNext(stripped) ??
      matchSkip(stripped) ??
      matchStartOver(stripped);

    if (!command) {
      return { isCommand: false, normalizedTranscript };
    }

    // For textarea, require a clear navigation cue for NEXT (avoid "next week..." answers).
    if (command === 'next' && isFreeTextField(fieldType) && !hasStrongNavigationCue(stripped)) {
      if (wordCount > 4 && !isShortExactCommand(stripped, 'next')) {
        return { isCommand: false, normalizedTranscript };
      }
    }

    return {
      isCommand: true,
      command,
      normalizedTranscript,
    };
  }
}

function isFreeTextField(fieldType: string): boolean {
  return fieldType === 'text' || fieldType === 'textarea' || fieldType === 'email';
}

function normalizeCommandText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPoliteFillers(value: string): string {
  return value
    .replace(
      /^(okay|ok|alright|all right|please|can you|could you|would you|will you|can we|could we|i want to|i would like to|i'd like to|let us|let's|hey|um|uh)\s+/g,
      '',
    )
    .replace(
      /\s+(please|thanks|thank you|now|for me)$/g,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeContentWithIncidentalKeywords(value: string): boolean {
  return (
    /\bnext (week|month|year|time|day|morning|evening|shift)\b/.test(value) ||
    /\b(the|a|an) next\b/.test(value) && !/\bnext (question|one)\b/.test(value) ||
    /\bwhat (should|will|do|is|are).*\bnext\b/.test(value) ||
    /\bback (to work|home|tomorrow|later)\b/.test(value)
  );
}

function hasStrongNavigationCue(value: string): boolean {
  return (
    /\b(next question|previous question|go back|go next|move next|move back|change (the )?question|take me (to|back)|say (that|it|the question) again|repeat (the )?question|what was the question)\b/.test(
      value,
    ) ||
    /^(next|back|previous|repeat|continue|skip)(\s+(question|one))?$/.test(value)
  );
}

function isShortExactCommand(value: string, kind: 'next' | 'previous' | 'repeat'): boolean {
  if (kind === 'next') {
    return /^(next|continue|proceed|go ahead|go next|next one|next question)$/.test(value);
  }
  if (kind === 'previous') {
    return /^(back|previous|go back|previous one|previous question)$/.test(value);
  }
  return /^(repeat|say again|repeat that|repeat question)$/.test(value);
}

function matchNext(value: string): VoiceCommandType | null {
  const patterns = [
    /^(next|continue|proceed|go ahead)$/,
    /^next (question|one)$/,
    /^(go|move) (to )?(the )?next( question| one)?$/,
    /^(go|move) next$/,
    /^take me to (the )?next( question| one)?$/,
    /^change (to )?(the )?(next )?question$/,
    /^change the question$/,
    /^(can we|lets|let us) (go to|move to) (the )?next( question| one)?$/,
    /^okay next( question)?$/,
    /^ok next( question)?$/,
  ];

  if (patterns.some((pattern) => pattern.test(value))) {
    return 'next';
  }

  // Soft intent: short utterances centered on next-question navigation.
  if (
    value.split(' ').length <= 8 &&
    /\b(go|move|take me|change).{0,20}\b(next)(\s+(question|one))?\b/.test(value)
  ) {
    return 'next';
  }

  if (value.split(' ').length <= 6 && /\bnext question\b/.test(value)) {
    return 'next';
  }

  return null;
}

function matchPrevious(value: string): VoiceCommandType | null {
  const patterns = [
    /^(back|previous)$/,
    /^(go|move) back$/,
    /^(go|move) (to )?(the )?previous( question| one)?$/,
    /^previous (question|one)$/,
    /^take me back( to (the )?previous( question| one)?)?$/,
    /^take me to (the )?previous( question| one)?$/,
    /^i want to go back$/,
    /^go back to (the )?previous( question| one)?$/,
  ];

  if (patterns.some((pattern) => pattern.test(value))) {
    return 'previous';
  }

  if (
    value.split(' ').length <= 10 &&
    /\b(go|move|take me).{0,20}\b(back|previous)(\s+(question|one))?\b/.test(value)
  ) {
    return 'previous';
  }

  return null;
}

function matchRepeat(value: string): VoiceCommandType | null {
  const patterns = [
    /^(repeat|repeat that|repeat question|repeat the question)$/,
    /^say (that|it|the question) again$/,
    /^please (repeat|say).*$/,
    /^can you (repeat|say).*$/,
    /^i (didn t|didnt|couldn t|couldnt) hear( that| the question)?$/,
    /^what was the question$/,
    /^tell me the question again$/,
    /^read (the question |it )?again$/,
  ];

  // Normalize apostrophes already stripped to spaces → "didn t"
  const soft = value.replace(/\bi didn t\b/g, 'i didnt').replace(/\bi couldn t\b/g, 'i couldnt');

  if (patterns.some((pattern) => pattern.test(value) || pattern.test(soft))) {
    return 'repeat';
  }

  if (
    value.split(' ').length <= 10 &&
    /\b(repeat|say again|say that again|hear that|hear the question|what was the question)\b/.test(
      value,
    )
  ) {
    return 'repeat';
  }

  return null;
}

function matchSkip(value: string): VoiceCommandType | null {
  if (/^(skip|skip (this|the)? ?question|skip this)$/.test(value)) {
    return 'skip';
  }
  return null;
}

function matchStartOver(value: string): VoiceCommandType | null {
  if (/^(start over|restart|begin again|start again)$/.test(value)) {
    return 'startOver';
  }
  return null;
}
