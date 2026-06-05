import { FormField } from '../models/form-field.model';
import { normalizeFieldTypeName } from './field-type.utils';
import { readOptionSourceFromField } from './option-source.utils';

export function generateFieldId(): string {
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

  return {
    id: String(field.id || generateFieldId()),
    type,
    fieldTypeName,
    label,
    name: field.name || toFieldName(label),
    placeholder: field.placeholder || '',
    required: readRequired(field),
    isShow: readBooleanFlag(field, 'isShow', 'is_show', true),
    isReadonly: readBooleanFlag(field, 'isReadonly', 'is_readonly', false),
    options: [...(field.options || [])],
    optionSource: readOptionSourceFromField(field),
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
