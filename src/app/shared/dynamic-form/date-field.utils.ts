import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  isValidIsoDate,
  sanitizeDateBounds,
} from './range-field.utils';

export interface DateFieldConfigLike {
  type?: string;
  minDate?: string | null;
  maxDate?: string | null;
  required?: boolean;
}

export function isDateFieldType(type?: string | null): boolean {
  return type === 'date';
}

export function normalizeDateFieldValue(raw: unknown): string | null {
  if (raw == null || raw === '') {
    return null;
  }
  const text = String(raw).trim();
  if (!text) {
    return null;
  }
  return isValidIsoDate(text) ? text : text;
}

/**
 * Single-date field validator (min/max optional).
 * Reuses ISO date helpers shared with Range date configuration.
 */
export function dateFieldValidator(
  field: DateFieldConfigLike,
  options?: { required?: boolean; visible?: boolean },
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const required = options?.required ?? !!field.required;
    const visible = options?.visible ?? true;

    if (!visible) {
      return null;
    }

    const value = normalizeDateFieldValue(control.value);
    if (value == null || value === '') {
      return required ? { required: true } : null;
    }

    if (!isValidIsoDate(value)) {
      return { dateInvalid: true };
    }

    const bounds = sanitizeDateBounds(field.minDate, field.maxDate);
    const errors: ValidationErrors = {};

    if (bounds.rangeMinDate && value < bounds.rangeMinDate) {
      errors['dateBelowMin'] = { min: bounds.rangeMinDate };
    }

    if (bounds.rangeMaxDate && value > bounds.rangeMaxDate) {
      errors['dateAboveMax'] = { max: bounds.rangeMaxDate };
    }

    return Object.keys(errors).length ? errors : null;
  };
}

export function sanitizeDateFieldBounds(
  minDate: unknown,
  maxDate: unknown,
): { minDate?: string; maxDate?: string; swapped?: boolean } {
  const bounds = sanitizeDateBounds(minDate, maxDate);
  return {
    minDate: bounds.rangeMinDate,
    maxDate: bounds.rangeMaxDate,
    swapped: bounds.swapped,
  };
}
