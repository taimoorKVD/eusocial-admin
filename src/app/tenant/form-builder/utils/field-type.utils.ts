import { FieldType } from '../models/form-field.model';

const FIELD_TYPE_MAP: Record<string, FieldType> = {
  text: 'text',
  email: 'email',
  number: 'number',
  textarea: 'textarea',
  select: 'select',
  dropdown: 'select',
  radio: 'radio',
  checkbox: 'checkbox',
  image: 'image',
  file: 'image',
  parameter: 'parameter',
  signature: 'signature',
  time: 'time',
  // Legacy Form Builder type — migrate saved schemas to Time.
  'user-timestamp': 'time',
  rating: 'rating',
  range: 'range',
  barcode: 'barcode',
  'qr-code': 'qr-code',
};

export function normalizeFieldTypeName(
  fieldTypeName?: string | null,
  fallbackType?: FieldType | string | null
): FieldType {
  const raw = String(fieldTypeName || fallbackType || 'text')
    .trim()
    .toLowerCase();

  return FIELD_TYPE_MAP[raw] ?? 'text';
}

export function isOptionFieldType(type: FieldType): boolean {
  return type === 'select' || type === 'radio' || type === 'checkbox';
}
