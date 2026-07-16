import { FormField } from '../../../../form-builder/models/form-field.model';
import { createFieldFromTemplate } from '../../../../form-builder/utils/form-field.factory';
import { FieldType, FormFieldConfig, createId } from '../models/dynamic-form.models';

const BUILDER_TYPES: Array<{ label: string; value: FormField['type'] }> = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Email', value: 'email' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Select', value: 'select' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'Radio', value: 'radio' },
  { label: 'Image', value: 'image' },
];

export const FIELD_BUILDER_TYPE_OPTIONS = BUILDER_TYPES;

export function createDraftBuilderField(type: FormField['type'] = 'text'): FormField {
  return createFieldFromTemplate({
    type,
    label: '',
    placeholder: '',
    required: false,
    options: type === 'select' || type === 'radio' || type === 'checkbox' ? [] : [],
  });
}

export function mapBuilderFieldToConfig(field: FormField): FormFieldConfig {
  const mappedType = mapBuilderTypeToConfigType(field.type);
  const options = (field.options ?? [])
    .map((opt) => (typeof opt === 'string' ? opt : String(opt.label ?? opt.value)))
    .filter((opt) => opt.trim().length > 0);

  return {
    id: createId('field'),
    type: mappedType,
    label: (field.label || 'Untitled Field').trim(),
    name: (field.name || 'field').trim(),
    placeholder: field.placeholder?.trim() || undefined,
    required: !!field.required,
    readonly: field.isReadonly || undefined,
    options: options.length ? options : undefined,
    isDefault: false,
  };
}

function mapBuilderTypeToConfigType(type: FormField['type']): FieldType {
  if (type === 'image') return 'text';
  return type as FieldType;
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
