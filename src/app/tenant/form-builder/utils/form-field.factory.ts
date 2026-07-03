import { FieldOption, FieldType, FormField, OptionSource } from '../models/form-field.model';
import {
  normalizeCheckboxFieldOptions,
  normalizeStaticSelectFieldOptions,
} from './field-options.utils';
import { normalizeFieldTypeName } from './field-type.utils';
import { readOptionSourceFromField } from './option-source.utils';

export function generateFieldId(): string {
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const PLACEHOLDER_AUTO_GENERATION_TYPES: ReadonlySet<FieldType> = new Set([
  'text',
  'email',
  'number',
  'textarea',
]);

export function supportsPlaceholderAutoGeneration(type: FieldType | undefined): boolean {
  return type ? PLACEHOLDER_AUTO_GENERATION_TYPES.has(type) : false;
}

export function buildPlaceholderFromLabel(label: string | null | undefined): string {
  const trimmedLabel = String(label ?? '').trim();
  return trimmedLabel ? `Enter ${trimmedLabel}` : '';
}

export function toFieldName(label: string | null | undefined): string {
  const normalizedLabel = String(label ?? 'field');
  const fieldName = normalizedLabel
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return fieldName || 'field';
}

function cloneOptions(
  options: Array<string | { label: string; value: string | number }> = []
): Array<string | { label: string; value: string | number }> {
  return options.map(option =>
    typeof option === 'string' ? option : { ...option }
  );
}

export function cloneOptionSourceOptions(
  options?: string[] | FieldOption[]
): string[] | FieldOption[] | undefined {
  if (!options) {
    return undefined;
  }

  if (options.every(option => typeof option === 'string')) {
    return [...options] as string[];
  }

  return (options as FieldOption[]).map(option => ({ ...option }));
}

export function cloneOptionSource(optionSource?: OptionSource): OptionSource | undefined {
  if (!optionSource) {
    return undefined;
  }

  return {
    ...optionSource,
    response: optionSource.response ? { ...optionSource.response } : undefined,
    options: cloneOptionSourceOptions(optionSource.options),
  };
}

function readFieldIdentifier(
  field: Partial<FormField> & Record<string, unknown>
): string {
  return String(
    field.id ?? field['fieldId'] ?? field['field_id'] ?? field['key'] ?? generateFieldId()
  );
}

function readBooleanFlag(
  field: Partial<FormField> & Record<string, unknown>,
  camelKey: keyof FormField,
  snakeKey: string,
  defaultValue: boolean
): boolean {
  const camelValue = field[camelKey];

  if (typeof camelValue === 'boolean') {
    return camelValue;
  }

  if (typeof field[snakeKey] === 'boolean') {
    return field[snakeKey];
  }

  return defaultValue;
}

function readRequired(field: Partial<FormField> & Record<string, unknown>): boolean {
  return readBooleanFlag(field, 'required', 'isRequired', false);
}

function readFieldTypeName(field: Partial<FormField> & Record<string, unknown>): string {
  const fieldType = field['fieldType'];

  if (fieldType && typeof fieldType === 'object') {
    const typeRecord = fieldType as Record<string, unknown>;
    const nestedName = typeRecord['name'] ?? typeRecord['type'];

    if (nestedName) {
      return String(nestedName);
    }
  }

  return String(
    field.fieldTypeName ?? field['field_type_name'] ?? field.type ?? 'text'
  );
}

function isStaticSelectField(
  type: FormField['type'],
  optionSource?: OptionSource
): boolean {
  return (
    type === 'select' &&
    optionSource?.type !== 'dynamic' &&
    optionSource?.type !== 'api'
  );
}

function resolveFieldOptions(
  type: FormField['type'],
  optionSource: OptionSource | undefined,
  options: FormField['options'] | undefined
): FormField['options'] {
  if (type === 'checkbox') {
    return normalizeCheckboxFieldOptions(options);
  }

  if (isStaticSelectField(type, optionSource)) {
    return normalizeStaticSelectFieldOptions(options);
  }

  return cloneOptions(options);
}

export function createFieldFromTemplate(template: Partial<FormField>): FormField {
  return sanitizeField(template);
}

export function sanitizeField(
  field: Partial<FormField> & Record<string, unknown>,
  order?: number
): FormField {
  const label =
    typeof field.label === 'string' && field.label.trim()
      ? field.label
      : 'Untitled Field';

  const fieldTypeName = readFieldTypeName(field);
  const type = normalizeFieldTypeName(fieldTypeName, field.type);
  const optionSource = readOptionSourceFromField(field);

  return {
    id: readFieldIdentifier(field),
    type,
    fieldTypeName,
    label,
    name: toFieldName(label),
    placeholder: field.placeholder || '',
    required: readRequired(field),
    isShow: readBooleanFlag(field, 'isShow', 'is_show', true),
    isReadonly: readBooleanFlag(field, 'isReadonly', 'is_readonly', false),
    isEditable: readBooleanFlag(field, 'isEditable', 'is_editable', true),
    options: resolveFieldOptions(type, optionSource, field.options),
    optionSource: cloneOptionSource(optionSource),
    value: field.value ?? field.defaultValue ?? null,
    defaultValue: field.defaultValue ?? null,
    validations: field.validations ? { ...field.validations } : {},
    width: field.width ?? 12,
    order: order ?? field.order,
    condition: field.condition
      ? { ...field.condition }
      : { fieldId: '', value: '' },
  };
}

export function normalizeFieldOrder(schema: Array<Partial<FormField>>): FormField[] {
  return schema.map((field, index) => sanitizeField(field, index + 1));
}
