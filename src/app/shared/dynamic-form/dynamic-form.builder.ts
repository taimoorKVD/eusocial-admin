import { FormBuilder, FormControl, Validators } from '@angular/forms';
import {
  DynamicField,
  DynamicFieldOption,
  DynamicFormValue,
} from '../../interfaces/dynamic-field';

export function sortDynamicFields(fields: DynamicField[]): DynamicField[] {
  return [...fields]
    .map((field, index) => ({ field, index }))
    .sort(
      (a, b) =>
        (a.field.order ?? a.index) - (b.field.order ?? b.index) || a.index - b.index,
    )
    .map(({ field }) => field);
}

export function getOptionValue(
  option: string | DynamicFieldOption,
  index = 0,
): string | number {
  return typeof option === 'string' ? option : (option.value ?? index);
}

export function getInitialFieldValue(field: DynamicField): unknown {
  switch (field.type) {
    case 'radio': {
      if (
        field.defaultValue !== undefined &&
        field.defaultValue !== null &&
        field.defaultValue !== ''
      ) {
        return field.defaultValue;
      }

      if (field.value !== undefined && field.value !== null && field.value !== '') {
        return field.value;
      }

      const firstOption = field.options?.[0];
      return firstOption !== undefined ? getOptionValue(firstOption, 0) : '';
    }
    case 'checkbox':
      return false;
    case 'number':
      return field.defaultValue ?? field.value ?? null;
    case 'image':
      return field.defaultValue ?? field.value ?? null;
    default:
      return field.defaultValue ?? field.value ?? '';
  }
}

export function getFieldValidators(field: DynamicField) {
  const validators = [];
  if (field.required) validators.push(Validators.required);
  if (field.type === 'email') validators.push(Validators.email);
  return validators;
}

export function buildDynamicFormGroupConfig(
  fb: FormBuilder,
  sortedFields: DynamicField[],
): Record<string, FormControl | unknown[]> {
  const groupConfig: Record<string, FormControl | unknown[]> = {};

  for (const field of sortedFields) {
    if (field.type === 'checkbox') {
      const selectedValues = Array.isArray(field.value) ? field.value : [];
      groupConfig[field.name] = new FormControl(selectedValues);
      continue;
    }

    groupConfig[field.name] = [
      getInitialFieldValue(field),
      getFieldValidators(field),
    ];
  }

  return groupConfig;
}

export function normalizeCheckboxFormValue(
  raw: DynamicFormValue,
  sortedFields: DynamicField[],
): DynamicFormValue {
  const result: DynamicFormValue = { ...raw };

  for (const field of sortedFields) {
    if (field.type !== 'checkbox') continue;

    const value = raw[field.name];

    if ((field.options?.length ?? 0) <= 1) {
      result[field.name] = !!value;
      continue;
    }

    result[field.name] = Array.isArray(value) ? value.filter(Boolean) : [];
  }

  return result;
}
