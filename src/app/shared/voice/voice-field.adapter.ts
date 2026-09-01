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
      return 'structured';
    default:
      return 'none';
  }
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
  const options = context.getFieldOptions?.(field) ?? field.options ?? [];
  if (!options.length) {
    return { success: false, unsupported: true };
  }

  const normalizedTranscript = normalizeSpeechText(transcript);
  const exactMatches = options.filter((option, index) => {
    const label = normalizeSpeechText(getOptionLabel(option, index));
    const value = normalizeSpeechText(String(getOptionValue(option, index)));
    return (
      normalizedTranscript === label ||
      normalizedTranscript === value ||
      normalizedTranscript.includes(label) ||
      label.includes(normalizedTranscript)
    );
  });

  if (exactMatches.length !== 1) {
    return { success: false, ambiguous: exactMatches.length > 1 };
  }

  const matchIndex = options.indexOf(exactMatches[0]);
  return {
    success: true,
    parsedValue: getOptionValue(exactMatches[0], Math.max(matchIndex, 0)),
  };
}

function getOptionLabel(option: string | DynamicFieldOption, index: number): string {
  return typeof option === 'string' ? option : option.label;
}

function normalizeSpeechText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractSpokenNumber(transcript: string, allowDecimal: boolean): number | null {
  const normalized = transcript.replace(/,/g, ' ').trim();
  const pattern = allowDecimal ? /-?\d+(?:\.\d+)?/ : /-?\d+/;
  const match = normalized.match(pattern);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}
