import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { allowsDecimalPoint, sanitizeNumberFieldInput } from './number-field.utils';

export type RangeFieldType = 'number' | 'date' | 'time';
export type RangeTimeFormat = '12' | '24';

export interface RangeFieldValue {
  from: string | number | null;
  to: string | number | null;
}

export interface RangeFieldConfigLike {
  type?: string;
  rangeType?: RangeFieldType | string | null;
  rangeMin?: number | null;
  rangeMax?: number | null;
  rangeStep?: number | null;
  rangeMinDate?: string | null;
  rangeMaxDate?: string | null;
  rangePlaceholderFrom?: string | null;
  rangePlaceholderTo?: string | null;
  allowDecimal?: boolean;
  timeFormat?: RangeTimeFormat | string | null;
  required?: boolean;
}

export const DEFAULT_RANGE_TYPE: RangeFieldType = 'number';
export const DEFAULT_RANGE_TIME_FORMAT: RangeTimeFormat = '24';
export const DEFAULT_RANGE_STEP = 1;
export const DEFAULT_RANGE_PLACEHOLDER_FROM = 'From';
export const DEFAULT_RANGE_PLACEHOLDER_TO = 'To';

export function getRangePlaceholderFrom(
  field: RangeFieldConfigLike | null | undefined,
): string {
  const custom = field?.rangePlaceholderFrom?.trim();
  return custom || DEFAULT_RANGE_PLACEHOLDER_FROM;
}

export function getRangePlaceholderTo(
  field: RangeFieldConfigLike | null | undefined,
): string {
  const custom = field?.rangePlaceholderTo?.trim();
  return custom || DEFAULT_RANGE_PLACEHOLDER_TO;
}

/** Pick the later of two ISO `Y-m-d` dates (invalid/empty values ignored). */
export function laterIsoDate(
  a?: string | null,
  b?: string | null,
): string | undefined {
  const left = typeof a === 'string' && isValidIsoDate(a) ? a : undefined;
  const right = typeof b === 'string' && isValidIsoDate(b) ? b : undefined;
  if (left && right) {
    return left >= right ? left : right;
  }
  return left || right;
}

/** Pick the earlier of two ISO `Y-m-d` dates (invalid/empty values ignored). */
export function earlierIsoDate(
  a?: string | null,
  b?: string | null,
): string | undefined {
  const left = typeof a === 'string' && isValidIsoDate(a) ? a : undefined;
  const right = typeof b === 'string' && isValidIsoDate(b) ? b : undefined;
  if (left && right) {
    return left <= right ? left : right;
  }
  return left || right;
}

export function isRangeFieldType(type?: string | null): boolean {
  return type === 'range';
}

export function normalizeRangeType(raw: unknown): RangeFieldType {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (value === 'date' || value === 'time' || value === 'number') {
    return value;
  }

  return DEFAULT_RANGE_TYPE;
}

export function normalizeRangeTimeFormat(raw: unknown): RangeTimeFormat {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (value === '12' || value === '12h' || value === '12-hour') {
    return '12';
  }

  return DEFAULT_RANGE_TIME_FORMAT;
}

export function createEmptyRangeValue(): RangeFieldValue {
  return { from: null, to: null };
}

/**
 * Normalize stored range answers.
 * Supports structured `{ from, to }` and legacy `"from-to"` strings.
 */
export function normalizeRangeValue(raw: unknown): RangeFieldValue {
  if (raw == null || raw === '') {
    return createEmptyRangeValue();
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    return {
      from: normalizeSideValue(record['from'] ?? record['min'] ?? record['start']),
      to: normalizeSideValue(record['to'] ?? record['max'] ?? record['end']),
    };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return createEmptyRangeValue();
    }

    // Prefer structured JSON if present.
    if (trimmed.startsWith('{')) {
      try {
        return normalizeRangeValue(JSON.parse(trimmed));
      } catch {
        // fall through to legacy hyphen format
      }
    }

    const separator = trimmed.includes('||')
      ? '||'
      : trimmed.includes(' – ')
        ? ' – '
        : trimmed.includes(' - ')
          ? ' - '
          : null;

    if (separator) {
      const [from, to] = trimmed.split(separator);
      return {
        from: normalizeSideValue(from),
        to: normalizeSideValue(to),
      };
    }

    // Legacy "a-b" (fragile for negatives; kept for old data).
    const hyphen = trimmed.indexOf('-', 1);
    if (hyphen > 0) {
      return {
        from: normalizeSideValue(trimmed.slice(0, hyphen)),
        to: normalizeSideValue(trimmed.slice(hyphen + 1)),
      };
    }
  }

  return createEmptyRangeValue();
}

function normalizeSideValue(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

export function isRangeValueEmpty(value: unknown): boolean {
  const normalized = normalizeRangeValue(value);
  return isSideEmpty(normalized.from) && isSideEmpty(normalized.to);
}

export function isSideEmpty(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || value === '';
}

export function isRangeValuePartial(value: unknown): boolean {
  const normalized = normalizeRangeValue(value);
  const fromEmpty = isSideEmpty(normalized.from);
  const toEmpty = isSideEmpty(normalized.to);
  return fromEmpty !== toEmpty;
}

export function resolveRangeStep(field: RangeFieldConfigLike): number {
  const raw = field.rangeStep;
  const numeric = typeof raw === 'number' ? raw : Number(raw);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_RANGE_STEP;
  }

  return numeric;
}

export function sanitizeRangeNumberInput(
  value: string,
  allowDecimal: boolean,
): string {
  return sanitizeNumberFieldInput(value, allowDecimal);
}

export function parseRangeNumber(value: string | number | null | undefined): number | null {
  if (isSideEmpty(value)) {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(numeric) ? numeric : null;
}

/** Minutes since midnight for HH:mm (24h) values. */
export function parseTimeToMinutes(value: string | number | null | undefined): number | null {
  if (isSideEmpty(value)) {
    return null;
  }

  const text = String(value).trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(text);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null;
    }
    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours < 0 || hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

export function formatMinutesToTime(
  totalMinutes: number,
  timeFormat: RangeTimeFormat = '24',
): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const mm = String(minutes).padStart(2, '0');

  if (timeFormat === '12') {
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${String(hours12).padStart(2, '0')}:${mm} ${meridiem}`;
  }

  return `${String(hours24).padStart(2, '0')}:${mm}`;
}

/** Normalize any time string to HH:mm (24h) for storage. */
export function normalizeTimeTo24h(value: string | number | null | undefined): string | null {
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) {
    return isSideEmpty(value) ? null : null;
  }
  return formatMinutesToTime(minutes, '24');
}

export function isValidIsoDate(value: string | number | null | undefined): boolean {
  if (isSideEmpty(value)) {
    return false;
  }

  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }

  const date = new Date(`${text}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function isMultipleOfStep(value: number, step: number, allowDecimal: boolean): boolean {
  if (!allowDecimal && !Number.isInteger(value)) {
    return false;
  }

  if (step <= 0) {
    return true;
  }

  const scale = allowDecimal ? 1e6 : 1;
  const scaledValue = Math.round(value * scale);
  const scaledStep = Math.round(step * scale);

  if (scaledStep === 0) {
    return true;
  }

  return scaledValue % scaledStep === 0;
}

export function formatRangeDisplayValue(
  raw: unknown,
  field?: RangeFieldConfigLike,
): string {
  const value = normalizeRangeValue(raw);
  if (isRangeValueEmpty(value)) {
    return '—';
  }

  const rangeType = normalizeRangeType(field?.rangeType);
  let from = value.from;
  let to = value.to;

  if (rangeType === 'time') {
    const format = normalizeRangeTimeFormat(field?.timeFormat);
    const fromMinutes = parseTimeToMinutes(from);
    const toMinutes = parseTimeToMinutes(to);
    from = fromMinutes == null ? from : formatMinutesToTime(fromMinutes, format);
    to = toMinutes == null ? to : formatMinutesToTime(toMinutes, format);
  }

  if (isSideEmpty(from) && isSideEmpty(to)) {
    return '—';
  }

  if (isSideEmpty(from)) {
    return String(to);
  }

  if (isSideEmpty(to)) {
    return String(from);
  }

  return `${from} – ${to}`;
}

/**
 * Shared range validator for FormControls holding `{ from, to }`.
 */
export function rangeFieldValidator(
  field: RangeFieldConfigLike,
  options?: { required?: boolean; visible?: boolean },
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const required = options?.required ?? !!field.required;
    const visible = options?.visible ?? true;

    if (!visible) {
      return null;
    }

    const value = normalizeRangeValue(control.value);
    const fromEmpty = isSideEmpty(value.from);
    const toEmpty = isSideEmpty(value.to);

    if (fromEmpty && toEmpty) {
      return required ? { required: true } : null;
    }

    if (fromEmpty || toEmpty) {
      return { rangeIncomplete: true };
    }

    const rangeType = normalizeRangeType(field.rangeType);

    if (rangeType === 'number') {
      return validateNumberRange(value, field);
    }

    if (rangeType === 'date') {
      return validateDateRange(value, field);
    }

    return validateTimeRange(value);
  };
}

function validateNumberRange(
  value: RangeFieldValue,
  field: RangeFieldConfigLike,
): ValidationErrors | null {
  const from = parseRangeNumber(value.from);
  const to = parseRangeNumber(value.to);

  if (from == null || to == null) {
    return { rangeInvalid: true };
  }

  const allowDecimal = allowsDecimalPoint(field);
  const step = resolveRangeStep(field);
  const errors: ValidationErrors = {};

  if (!allowDecimal && (!Number.isInteger(from) || !Number.isInteger(to))) {
    errors['integerOnly'] = true;
  }

  if (field.rangeMin != null && Number.isFinite(field.rangeMin)) {
    if (from < field.rangeMin || to < field.rangeMin) {
      errors['rangeBelowMin'] = { min: field.rangeMin };
    }
  }

  if (field.rangeMax != null && Number.isFinite(field.rangeMax)) {
    if (from > field.rangeMax || to > field.rangeMax) {
      errors['rangeAboveMax'] = { max: field.rangeMax };
    }
  }

  if (!isMultipleOfStep(from, step, allowDecimal) || !isMultipleOfStep(to, step, allowDecimal)) {
    errors['rangeStep'] = { step };
  }

  if (from > to) {
    errors['rangeOrder'] = true;
  }

  return Object.keys(errors).length ? errors : null;
}

function validateDateRange(
  value: RangeFieldValue,
  field: RangeFieldConfigLike,
): ValidationErrors | null {
  const from = String(value.from ?? '').trim();
  const to = String(value.to ?? '').trim();
  const errors: ValidationErrors = {};

  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return { rangeInvalid: true };
  }

  if (field.rangeMinDate && isValidIsoDate(field.rangeMinDate)) {
    if (from < field.rangeMinDate || to < field.rangeMinDate) {
      errors['rangeBelowMin'] = { min: field.rangeMinDate };
    }
  }

  if (field.rangeMaxDate && isValidIsoDate(field.rangeMaxDate)) {
    if (from > field.rangeMaxDate || to > field.rangeMaxDate) {
      errors['rangeAboveMax'] = { max: field.rangeMaxDate };
    }
  }

  if (from > to) {
    errors['rangeOrder'] = true;
  }

  return Object.keys(errors).length ? errors : null;
}

function validateTimeRange(value: RangeFieldValue): ValidationErrors | null {
  const fromMinutes = parseTimeToMinutes(value.from);
  const toMinutes = parseTimeToMinutes(value.to);

  if (fromMinutes == null || toMinutes == null) {
    return { rangeInvalid: true };
  }

  if (fromMinutes > toMinutes) {
    return { rangeOrder: true };
  }

  return null;
}

/** Clear type-specific props when switching rangeType in Form Builder. */
export function resetRangeTypeSpecificConfig(
  field: RangeFieldConfigLike,
  nextType: RangeFieldType,
): void {
  field.rangeType = nextType;

  if (nextType !== 'number') {
    field.rangeMin = undefined;
    field.rangeMax = undefined;
    field.rangeStep = undefined;
    field.allowDecimal = undefined;
  } else {
    field.rangeStep = field.rangeStep ?? DEFAULT_RANGE_STEP;
    field.allowDecimal = field.allowDecimal === true;
  }

  if (nextType !== 'date') {
    field.rangeMinDate = undefined;
    field.rangeMaxDate = undefined;
  }

  if (nextType !== 'time') {
    field.timeFormat = undefined;
  } else {
    field.timeFormat = normalizeRangeTimeFormat(field.timeFormat);
  }
}

export function sanitizeRangeBounds(
  rangeMin: unknown,
  rangeMax: unknown,
): { rangeMin?: number; rangeMax?: number; swapped?: boolean } {
  const min =
    rangeMin === null || rangeMin === undefined || rangeMin === ''
      ? undefined
      : Number(rangeMin);
  const max =
    rangeMax === null || rangeMax === undefined || rangeMax === ''
      ? undefined
      : Number(rangeMax);

  const hasMin = min != null && Number.isFinite(min);
  const hasMax = max != null && Number.isFinite(max);

  if (hasMin && hasMax && (min as number) > (max as number)) {
    return { rangeMin: max as number, rangeMax: min as number, swapped: true };
  }

  return {
    rangeMin: hasMin ? (min as number) : undefined,
    rangeMax: hasMax ? (max as number) : undefined,
  };
}

export function sanitizeDateBounds(
  rangeMinDate: unknown,
  rangeMaxDate: unknown,
): { rangeMinDate?: string; rangeMaxDate?: string; swapped?: boolean } {
  const min =
    typeof rangeMinDate === 'string' && isValidIsoDate(rangeMinDate)
      ? rangeMinDate
      : undefined;
  const max =
    typeof rangeMaxDate === 'string' && isValidIsoDate(rangeMaxDate)
      ? rangeMaxDate
      : undefined;

  if (min && max && min > max) {
    return { rangeMinDate: max, rangeMaxDate: min, swapped: true };
  }

  return { rangeMinDate: min, rangeMaxDate: max };
}
