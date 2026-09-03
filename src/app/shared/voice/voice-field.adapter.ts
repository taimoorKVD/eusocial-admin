import {
  DynamicField,
  DynamicFieldOption,
} from '../../interfaces/dynamic-field';
import { getOptionValue } from '../dynamic-form/dynamic-form.builder';
import { allowsDecimalPoint } from '../dynamic-form/number-field.utils';
import {
  createEmptyMeasurementValue,
  normalizeMeasurementValue,
} from '../dynamic-form/measurement-field.utils';
import {
  isMeasurementFieldType,
  normalizeMeasurementUnitMode,
} from '../dynamic-form/measurement-units';

export type VoiceFieldSupport = 'text' | 'structured' | 'none';

export interface VoiceApplyResult {
  success: boolean;
  ambiguous?: boolean;
  unsupported?: boolean;
  parsedValue?: unknown;
}

export interface VoiceParseContext {
  getFieldOptions?: (field: DynamicField) => (string | DynamicFieldOption)[];
}

export function getVoiceFieldSupport(field: DynamicField): VoiceFieldSupport {
  if (field.isReadonly) {
    return 'none';
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'number':
    case 'price':
    case 'length':
    case 'mass':
    case 'volume':
      return 'text';
    case 'select':
    case 'radio':
    case 'checkbox':
    case 'rating':
      return 'structured';
    // Media / scanners / date-time stay manual for reliability.
    default:
      return 'none';
  }
}

/** Central capability check for intelligent voice mode. */
export function isVoiceInputSupported(field: DynamicField): boolean {
  return getVoiceFieldSupport(field) !== 'none';
}

export function parseVoiceTranscript(
  field: DynamicField,
  transcript: string,
  context: VoiceParseContext = {},
): VoiceApplyResult {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return { success: false };
  }

  const support = getVoiceFieldSupport(field);
  if (support === 'none') {
    return { success: false, unsupported: true };
  }

  if (support === 'structured') {
    return parseStructuredVoiceValue(field, trimmed, context);
  }

  return parseTextLikeVoiceValue(field, trimmed);
}

function parseTextLikeVoiceValue(field: DynamicField, transcript: string): VoiceApplyResult {
  switch (field.type) {
    case 'number':
      return parseNumberVoiceValue(field, transcript);
    case 'price':
    case 'length':
    case 'mass':
    case 'volume':
      return parseMeasurementVoiceValue(field, transcript);
    case 'text':
    case 'textarea':
    case 'email':
    default:
      return { success: true, parsedValue: transcript };
  }
}

function parseNumberVoiceValue(field: DynamicField, transcript: string): VoiceApplyResult {
  const parsed = extractSpokenNumber(transcript, allowsDecimalPoint(field));
  if (parsed === null) {
    return { success: false };
  }

  return { success: true, parsedValue: parsed };
}

function parseMeasurementVoiceValue(field: DynamicField, transcript: string): VoiceApplyResult {
  if (!isMeasurementFieldType(field.type)) {
    return { success: false, unsupported: true };
  }

  const parsed = extractSpokenNumber(transcript, true);
  if (parsed === null) {
    return { success: false };
  }

  const empty = createEmptyMeasurementValue(field.type, field.unit);
  const normalized = normalizeMeasurementValue(
    { value: parsed, unit: empty.unit },
    field.type,
    {
      unitMode: normalizeMeasurementUnitMode(field.unitMode),
      unit: field.unit,
    },
  );

  return { success: true, parsedValue: normalized };
}

function parseStructuredVoiceValue(
  field: DynamicField,
  transcript: string,
  context: VoiceParseContext,
): VoiceApplyResult {
  if (field.type === 'rating') {
    return parseRatingVoiceValue(field, transcript);
  }

  const options = context.getFieldOptions?.(field) ?? field.options ?? [];
  if (!options.length) {
    return { success: false, unsupported: true };
  }

  if (field.type === 'checkbox') {
    return parseCheckboxVoiceValue(field, transcript, options);
  }

  const normalizedTranscript = stripOptionFillers(normalizeSpeechText(transcript));
  const scored = options
    .map((option, index) => {
      const label = normalizeSpeechText(getOptionLabel(option, index));
      const value = normalizeSpeechText(String(getOptionValue(option, index)));
      let score = 0;

      if (normalizedTranscript === label || normalizedTranscript === value) {
        score = 100;
      } else if (label && normalizedTranscript.includes(label)) {
        score = 80 + Math.min(label.length, 20);
      } else if (value && normalizedTranscript.includes(value)) {
        score = 70;
      } else if (label && label.includes(normalizedTranscript) && normalizedTranscript.length >= 3) {
        score = 60;
      }

      return { option, index, score, label };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return { success: false };
  }

  // Ambiguous if top two are close.
  if (scored.length > 1 && scored[0].score - scored[1].score < 10 && scored[1].score >= 60) {
    return { success: false, ambiguous: true };
  }

  const best = scored[0];
  return {
    success: true,
    parsedValue: getOptionValue(best.option, Math.max(best.index, 0)),
  };
}

function parseCheckboxVoiceValue(
  field: DynamicField,
  transcript: string,
  options: (string | DynamicFieldOption)[],
): VoiceApplyResult {
  const normalizedTranscript = stripOptionFillers(normalizeSpeechText(transcript));
  const selected: unknown[] = [];

  options.forEach((option, index) => {
    const label = normalizeSpeechText(getOptionLabel(option, index));
    const value = normalizeSpeechText(String(getOptionValue(option, index)));
    if (!label && !value) {
      return;
    }

    if (
      (label && normalizedTranscript.includes(label)) ||
      (value && normalizedTranscript.includes(value))
    ) {
      selected.push(getOptionValue(option, index));
    }
  });

  if (!selected.length) {
    return { success: false };
  }

  return { success: true, parsedValue: selected };
}

function parseRatingVoiceValue(field: DynamicField, transcript: string): VoiceApplyResult {
  const max =
    typeof field.maxRating === 'number' && Number.isFinite(field.maxRating)
      ? field.maxRating
      : 5;
  const parsed = extractSpokenNumber(transcript, false);
  if (parsed === null) {
    return { success: false };
  }

  const rating = Math.round(parsed);
  if (rating < 1 || rating > max) {
    return { success: false };
  }

  return { success: true, parsedValue: rating };
}

function stripOptionFillers(value: string): string {
  return value
    .replace(
      /^(i (am|choose|want|pick|select|d say|would say)|id say|please|select|choose)\s+/g,
      '',
    )
    .replace(/\s+please$/g, '')
    .trim();
}

function getOptionLabel(option: string | DynamicFieldOption, index: number): string {
  return typeof option === 'string' ? option : option.label;
}

function normalizeSpeechText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSpokenNumber(transcript: string, allowDecimal: boolean): number | null {
  const normalized = transcript.replace(/,/g, ' ').trim().toLowerCase();
  const pattern = allowDecimal ? /-?\d+(?:\.\d+)?/ : /-?\d+/;
  const digitMatch = normalized.match(pattern);
  if (digitMatch) {
    const parsed = Number(digitMatch[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return parseSpokenNumberWords(normalized, allowDecimal);
}

const ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function parseSpokenNumberWords(transcript: string, allowDecimal: boolean): number | null {
  const cleaned = transcript
    .replace(/[^a-z\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return null;
  }

  let negative = false;
  let working = cleaned;
  if (working.startsWith('minus ') || working.startsWith('negative ')) {
    negative = true;
    working = working.replace(/^(minus|negative)\s+/, '');
  }

  const pointParts = working.split(/\bpoint\b|\bdot\b/);
  const wholePart = pointParts[0]?.trim() ?? '';
  const fractionPart = pointParts[1]?.trim() ?? '';

  const whole = parseIntegerWordChunk(wholePart);
  if (whole === null) {
    return null;
  }

  let value = whole;
  if (fractionPart) {
    if (!allowDecimal) {
      return null;
    }

    const fractionDigits = fractionPart
      .split(/\s+/)
      .map((token) => {
        if (/^\d+$/.test(token)) {
          return token;
        }
        if (token in ONES && ONES[token] < 10) {
          return String(ONES[token]);
        }
        return '';
      })
      .join('');

    if (!fractionDigits) {
      return null;
    }

    value = Number(`${whole}.${fractionDigits}`);
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return negative ? -value : value;
}

function parseIntegerWordChunk(chunk: string): number | null {
  if (!chunk) {
    return null;
  }

  if (/^-?\d+$/.test(chunk)) {
    return Number(chunk);
  }

  const tokens = chunk.split(/[\s-]+/).filter(Boolean);
  if (!tokens.length) {
    return null;
  }

  let total = 0;
  let current = 0;
  let matched = false;

  for (const token of tokens) {
    if (token === 'and') {
      continue;
    }

    if (token in ONES) {
      current += ONES[token];
      matched = true;
      continue;
    }

    if (token in TENS) {
      current += TENS[token];
      matched = true;
      continue;
    }

    if (token === 'hundred') {
      current = (current || 1) * 100;
      matched = true;
      continue;
    }

    if (token === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      matched = true;
      continue;
    }

    return null;
  }

  if (!matched) {
    return null;
  }

  return total + current;
}
