import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DynamicField } from '../../interfaces/dynamic-field';
import {
  formatMinutesToTime,
  normalizeTimeTo24h,
  parseTimeToMinutes,
  RangeTimeFormat,
} from './range-field.utils';

/** Default display format for standalone Time fields (supports AM/PM). */
export const DEFAULT_TIME_FIELD_FORMAT: RangeTimeFormat = '12';

export type TimeMeridiem = 'AM' | 'PM';

export function normalizeTimeFieldFormat(raw: unknown): RangeTimeFormat {
  if (raw === '12' || raw === 12 || raw === '12h') {
    return '12';
  }
  if (raw === '24' || raw === 24 || raw === '24h') {
    return '24';
  }
  return DEFAULT_TIME_FIELD_FORMAT;
}

/** Coerce any accepted time string to HH:mm (24h) for storage, or null when empty/invalid. */
export function normalizeTimeFieldValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return normalizeTimeTo24h(typeof value === 'string' || typeof value === 'number' ? value : String(value));
}

export function formatTimeFieldDisplay(
  value: unknown,
  timeFormat: RangeTimeFormat = DEFAULT_TIME_FIELD_FORMAT,
): string {
  const normalized = normalizeTimeFieldValue(value);
  if (!normalized) {
    return '—';
  }

  const minutes = parseTimeToMinutes(normalized);
  if (minutes == null) {
    return '—';
  }

  return formatMinutesToTime(minutes, normalizeTimeFieldFormat(timeFormat));
}

export function isValidTimeFieldValue(value: unknown): boolean {
  return normalizeTimeFieldValue(value) != null;
}

export function timeFieldValidator(
  field: DynamicField,
  options?: { required?: boolean; visible?: boolean },
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const visible = options?.visible ?? true;
    if (!visible) {
      return null;
    }

    const raw = control.value;
    const empty = raw === undefined || raw === null || raw === '';

    if (empty) {
      return (options?.required ?? !!field.required) ? { required: true } : null;
    }

    if (!isValidTimeFieldValue(raw)) {
      return { invalidTime: true };
    }

    return null;
  };
}

export function getTimeHour12(value: unknown): number | null {
  const minutes = parseTimeToMinutes(normalizeTimeFieldValue(value) ?? '');
  if (minutes == null) {
    return null;
  }
  const hours24 = Math.floor(minutes / 60);
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return hours12;
}

export function getTimeMinute(value: unknown): number | null {
  const minutes = parseTimeToMinutes(normalizeTimeFieldValue(value) ?? '');
  if (minutes == null) {
    return null;
  }
  return minutes % 60;
}

export function getTimeMeridiem(value: unknown): TimeMeridiem | null {
  const minutes = parseTimeToMinutes(normalizeTimeFieldValue(value) ?? '');
  if (minutes == null) {
    return null;
  }
  return Math.floor(minutes / 60) >= 12 ? 'PM' : 'AM';
}

/** Build HH:mm (24h) from 12-hour parts. */
export function composeTimeFrom12h(
  hour12: number | null | undefined,
  minute: number | null | undefined,
  meridiem: TimeMeridiem | null | undefined,
): string | null {
  if (
    hour12 == null ||
    minute == null ||
    !meridiem ||
    !Number.isInteger(hour12) ||
    !Number.isInteger(minute) ||
    hour12 < 1 ||
    hour12 > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  let hours24 = hour12 % 12;
  if (meridiem === 'PM') {
    hours24 += 12;
  }

  return `${String(hours24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const TIME_HOUR_OPTIONS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
export const TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
export const TIME_MERIDIEM_OPTIONS: TimeMeridiem[] = ['AM', 'PM'];
