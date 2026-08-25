import { AbstractControl } from '@angular/forms';
import { DynamicField } from '../../interfaces/dynamic-field';
import { normalizeRangeType } from './range-field.utils';

export function getDynamicFieldErrorMessage(
  field: DynamicField,
  control: AbstractControl | null,
  showErrors = true,
): string | null {
  if (!control?.errors || !showErrors) {
    return null;
  }

  if (control.errors['required']) {
    return `${field.label} is required.`;
  }

  if (control.errors['email'] || (field.type === 'email' && control.errors['pattern'])) {
    return 'Please enter a valid email address.';
  }

  if (control.errors['integerOnly']) {
    return `${field.label} must be a whole number.`;
  }

  if (control.errors['rangeIncomplete']) {
    return `${field.label} requires both From and To values.`;
  }

  if (control.errors['rangeOrder']) {
    if (field.type === 'range' && normalizeRangeType(field.rangeType) === 'date') {
      return 'From date cannot be later than To date.';
    }
    return 'Start value cannot be greater than end value.';
  }

  if (control.errors['rangeInvalid']) {
    return `${field.label} contains an invalid value.`;
  }

  if (control.errors['rangeBelowMin']) {
    return `${field.label} must be at least ${control.errors['rangeBelowMin'].min}.`;
  }

  if (control.errors['rangeAboveMax']) {
    return `${field.label} must be at most ${control.errors['rangeAboveMax'].max}.`;
  }

  if (control.errors['rangeStep']) {
    return `${field.label} must use step ${control.errors['rangeStep'].step}.`;
  }

  if (control.errors['maxlength']) {
    const requiredLength = control.errors['maxlength'].requiredLength;
    return `${field.label} must be at most ${requiredLength} characters.`;
  }

  if (control.errors['min']) {
    return `Value must be at least ${control.errors['min'].min}.`;
  }

  if (control.errors['max']) {
    return `Value must be at most ${control.errors['max'].max}.`;
  }

  return 'This field is invalid.';
}

export function shouldShowDynamicFieldError(control: AbstractControl | null): boolean {
  return !!control && (control.touched || control.dirty);
}
