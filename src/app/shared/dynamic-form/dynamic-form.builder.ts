import { FormBuilder, FormControl, Validators } from '@angular/forms';
import {
  DynamicField,
  DynamicFieldOption,
  DynamicFormValue,
} from '../../interfaces/dynamic-field';
import {
  getFieldCharacterLimit,
} from './character-limit.utils';
import { allowsDecimalPoint, integerNumberValidator } from './number-field.utils';
import { emailFieldPatternValidator } from './email-field.utils';
import {
  createEmptyRangeValue,
  normalizeRangeType,
  normalizeRangeValue,
  rangeFieldValidator,
} from './range-field.utils';
import {
  filterAnswerImages,
  imageFieldValidator,
} from '../../tenant/form-builder/utils/image-field.utils';
import {
  normalizeMaxRating,
  normalizeRatingValue,
} from './rating-field.utils';
import {
  normalizeSignatureValue,
  signatureFieldValidator,
} from './signature-field.utils';

export function sortDynamicFields(fields: DynamicField[]): DynamicField[] {
  return [...fields]
    .map((field, index) => ({ field, index }))
    .sort(
      (a, b) =>
        (a.field.order ?? a.index) - (b.field.order ?? b.index) || a.index - b.index,
    )
    .map(({ field }) => field);
}

export function serializeDynamicFieldsSchema(fields: DynamicField[]): string {
  if (!fields?.length) {
    return '';
  }

  return sortDynamicFields(fields)
    .map(
      (field) =>
        `${field.id}:${field.name}:${field.type}:${Number(!!field.required)}:${field.selectionType || 'single'}:${Number(field.isShow !== false)}:${Number(!!field.isReadonly)}:${Number(allowsDecimalPoint(field))}:${getFieldCharacterLimit(field) ?? ''}:${field.type === 'range' ? normalizeRangeType(field.rangeType) : ''}:${field.type === 'image' ? `${Number(!!field.multiple)}:${field.minFiles ?? ''}:${field.maxFiles ?? ''}:${(field.referenceImages || []).length}` : ''}:${field.type === 'rating' ? normalizeMaxRating(field.maxRating) : ''}:${JSON.stringify(field.condition ?? null)}`,
    )
    .join('|');
}

export function remapDynamicFormValuesByFieldId(
  values: DynamicFormValue,
  previousFields: DynamicField[],
  nextFields: DynamicField[],
): DynamicFormValue {
  const remapped: DynamicFormValue = {};
  const previousById = new Map(previousFields.map((field) => [field.id, field]));

  for (const field of nextFields) {
    const previous = previousById.get(field.id);

    if (previous && Object.prototype.hasOwnProperty.call(values, previous.name)) {
      remapped[field.name] = values[previous.name];
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(values, field.name)) {
      remapped[field.name] = values[field.name];
    }
  }

  return remapped;
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
      if (Array.isArray(field.defaultValue)) {
        return [...field.defaultValue];
      }
      if (Array.isArray(field.value)) {
        return [...field.value];
      }
      return [];
    case 'select': {
      if (isMultiSelectField(field)) {
        if (Array.isArray(field.defaultValue)) {
          return [...field.defaultValue];
        }
        if (Array.isArray(field.value)) {
          return [...field.value];
        }
        return [];
      }
      return field.defaultValue ?? field.value ?? '';
    }
    case 'number':
      return field.defaultValue ?? field.value ?? null;
    case 'rating':
      return normalizeRatingValue(
        field.defaultValue ?? field.value,
        normalizeMaxRating(field.maxRating),
      );
    case 'range':
      return normalizeRangeValue(field.defaultValue ?? field.value ?? createEmptyRangeValue());
    case 'image':
      return filterAnswerImages(field.defaultValue ?? field.value);
    case 'signature':
      return normalizeSignatureValue(field.defaultValue ?? field.value);
    default:
      return field.defaultValue ?? field.value ?? '';
  }
}

export function isMultiSelectField(field: DynamicField): boolean {
  return field.type === 'select' && field.selectionType === 'multi';
}

export function getFieldValidators(
  field: DynamicField,
  options?: { required?: boolean; visible?: boolean }
) {
  const validators = [];
  const required = options?.required ?? !!field.required;
  const visible = options?.visible ?? true;

  if (field.type === 'range') {
    validators.push(rangeFieldValidator(field, { required, visible }));
    return validators;
  }

  if (field.type === 'image') {
    validators.push(imageFieldValidator(field, { required, visible }));
    return validators;
  }

  if (field.type === 'signature') {
    validators.push(signatureFieldValidator(field, { required, visible }));
    return validators;
  }

  if (visible && required && field.type !== 'checkbox') {
    validators.push(Validators.required);
  }

  if (field.type === 'email') {
    validators.push(emailFieldPatternValidator);
  }

  if (field.type === 'number' && !allowsDecimalPoint(field)) {
    validators.push(integerNumberValidator());
  }

  if (field.type === 'rating') {
    const max = normalizeMaxRating(field.maxRating);
    validators.push(Validators.min(1), Validators.max(max));
  }

  const characterLimit = getFieldCharacterLimit(field);
  if (characterLimit != null) {
    validators.push(Validators.maxLength(characterLimit));
  }

  return validators;
}

export function buildDynamicFormGroupConfig(
  fb: FormBuilder,
  sortedFields: DynamicField[],
): Record<string, FormControl | unknown[]> {
  const groupConfig: Record<string, FormControl | unknown[]> = {};

  for (const field of sortedFields) {
    if (field.type === 'checkbox') {
      groupConfig[field.name] = new FormControl(getInitialFieldValue(field));
      continue;
    }

    if (isMultiSelectField(field)) {
      groupConfig[field.name] = [
        getInitialFieldValue(field),
        getFieldValidators(field),
      ];
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
    if (field.type === 'checkbox') {
      const value = raw[field.name];

      if ((field.options?.length ?? 0) <= 1) {
        result[field.name] = Array.isArray(value)
          ? value.some(item => item !== false && item != null && item !== '')
          : !!value;
        continue;
      }

      result[field.name] = Array.isArray(value) ? value.filter(Boolean) : [];
      continue;
    }

    if (isMultiSelectField(field)) {
      const value = raw[field.name];
      result[field.name] = Array.isArray(value) ? value.filter((item) => item !== '' && item != null) : [];
      continue;
    }

    if (field.type === 'rating') {
      result[field.name] = normalizeRatingValue(
        raw[field.name],
        normalizeMaxRating(field.maxRating),
      );
      continue;
    }

    if (field.type === 'signature') {
      result[field.name] = normalizeSignatureValue(raw[field.name]);
    }
  }

  return result;
}
