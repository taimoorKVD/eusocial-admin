import { FormField } from '../../../../form-builder/models/form-field.model';
import {
  createFieldFromTemplate,
  toFieldName,
} from '../../../../form-builder/utils/form-field.factory';
import { FieldType, FormFieldConfig, createId } from '../models/dynamic-form.models';

/** Builder type picker options (maps to FormField + FormFieldConfig). */
const BUILDER_TYPES: Array<{ label: string; value: FormField['type'] | FieldType }> = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  // { label: 'Email', value: 'email' },
  // { label: 'Password', value: 'password' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Select Box', value: 'select' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'Radio Button', value: 'radio' },
  // { label: 'Date Picker', value: 'date' },
  { label: 'Image', value: 'image' },
  { label: 'File Upload', value: 'file' },
];

export const FIELD_BUILDER_TYPE_OPTIONS = BUILDER_TYPES;

/** Types that FieldSettings / FormField understand natively. */
function toFormFieldType(type: string): FormField['type'] {
  switch (type) {
    case 'password':
    case 'date':
    case 'file':
      return 'text';
    case 'image':
      return 'image';
    case 'number':
    case 'email':
    case 'textarea':
    case 'select':
    case 'checkbox':
    case 'radio':
    case 'text':
      return type;
    default:
      return 'text';
  }
}

export function createDraftBuilderField(
  selectedType: string = 'text',
): FormField {
  const formFieldType = toFormFieldType(selectedType);
  return createFieldFromTemplate({
    type: formFieldType,
    fieldTypeName: selectedType,
    label: '',
    placeholder: '',
    required: false,
    options:
      formFieldType === 'select' || formFieldType === 'radio' || formFieldType === 'checkbox'
        ? []
        : [],
  });
}

export function mapBuilderFieldToConfig(
  field: FormField,
  selectedType?: string,
): FormFieldConfig {
  const type = resolveConfigType(field, selectedType);
  const options = (field.options ?? [])
    .map((opt) => (typeof opt === 'string' ? opt : String(opt.label ?? opt.value)))
    .filter((opt) => opt.trim().length > 0);

  return {
    id: createId('field'),
    type,
    label: (field.label || 'Untitled Field').trim(),
    name: toFieldName(field.label || field.name || 'field'),
    placeholder: field.placeholder?.trim() || undefined,
    required: !!field.required,
    readonly: field.isReadonly || undefined,
    options: options.length ? options : undefined,
    width: mapBuilderWidthToPercent(field.width),
    isDefault: false,
  };
}

function resolveConfigType(field: FormField, selectedType?: string): FieldType {
  const candidate = (selectedType || field.fieldTypeName || field.type || 'text').toLowerCase();

  const allowed: FieldType[] = [
    'text',
    'number',
    'email',
    'password',
    'textarea',
    'select',
    'checkbox',
    'date',
    'radio',
    'image',
    'file',
  ];

  if (allowed.includes(candidate as FieldType)) {
    return candidate as FieldType;
  }

  if (field.type === 'image') return 'image';
  if (allowed.includes(field.type as FieldType)) {
    return field.type as FieldType;
  }

  return 'text';
}

/** Convert FormField 12-col width to a CSS percentage used by section layout. */
export function mapBuilderWidthToPercent(width?: number): string {
  if (width == null || width <= 0) {
    return '25%';
  }
  const clamped = Math.min(12, Math.max(1, Math.round(width)));
  return `${Math.round((clamped / 12) * 100)}%`;
}

/** Approximate grid units (out of 12) for a FormFieldConfig width string. */
export function widthToGridUnits(width?: string): number {
  if (!width || width === 'auto') return 3;
  if (width.endsWith('%')) {
    const pct = parseFloat(width);
    if (Number.isFinite(pct) && pct > 0) {
      return Math.min(12, Math.max(1, Math.round((pct / 100) * 12)));
    }
  }
  return 3;
}

export function rowUsedGridUnits(fields: FormFieldConfig[]): number {
  return fields.reduce((sum, field) => sum + widthToGridUnits(field.width), 0);
}

export function resolveItemDisplayName(record: Record<string, unknown>): string {
  const preferredKeys = ['name', 'title', 'item_name', 'itemName', 'label'];
  for (const key of preferredKeys) {
    const value = record[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'id' || key.endsWith('_at') || key === 'createdAt' || key === 'updatedAt') {
      continue;
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return record['id'] != null ? `Item #${record['id']}` : 'Untitled item';
}
