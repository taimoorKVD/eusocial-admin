import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Number fields treat a missing `allowDecimal` as false so existing forms
 * keep integer-only behavior.
 */
export function allowsDecimalPoint(
  field: { allowDecimal?: boolean } | null | undefined,
): boolean {
  return field?.allowDecimal === true;
}

/**
 * Sanitize typed/pasted number input.
 * - allowDecimal=false: digits and an optional leading minus only
 * - allowDecimal=true: digits, optional leading minus, and at most one decimal point
 */
export function sanitizeNumberFieldInput(
  value: string,
  allowDecimal: boolean,
): string {
  if (!value) {
    return '';
  }

  const negative = value.trimStart().startsWith('-');
  let body = value.replace(/-/g, '');

  if (!allowDecimal) {
    body = body.replace(/[^0-9]/g, '');
    return negative && body.length ? `-${body}` : body;
  }

  body = body.replace(/[^0-9.]/g, '');
  const firstDot = body.indexOf('.');
  if (firstDot !== -1) {
    body =
      body.slice(0, firstDot + 1) +
      body.slice(firstDot + 1).replace(/\./g, '');
  }

  return negative ? `-${body}` : body;
}

/** Rejects non-integer values when decimals are not allowed. */
export function integerNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
      return { integerOnly: true };
    }

    return null;
  };
}

export function getNumberFieldStep(
  field: { allowDecimal?: boolean } | null | undefined,
): string {
  return allowsDecimalPoint(field) ? 'any' : '1';
}
