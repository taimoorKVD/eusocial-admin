import { FormField } from '../models/form-field.model';

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

export function createFieldFromTemplate(template: Partial<FormField>): FormField {
  const label =
    typeof template.label === 'string' && template.label.trim()
      ? template.label
      : 'Untitled Field';

  return {
    id: generateFieldId(),
    type: (template.type || 'text') as FormField['type'],
    label,
    name: template.name || toFieldName(label),
    placeholder: template.placeholder || '',
    required: template.required ?? false,
    options: [...(template.options || [])],
    value: template.value ?? null,
    defaultValue: template.defaultValue ?? null,
    validations: template.validations ? { ...template.validations } : {},
    width: template.width ?? 12,
    condition: template.condition
      ? { ...template.condition }
      : { fieldId: '', value: '' },
  };
}

export function sanitizeField(field: Partial<FormField>, order?: number): FormField {
  const label =
    typeof field.label === 'string' && field.label.trim()
      ? field.label
      : 'Untitled Field';

  return {
    id: field.id || generateFieldId(),
    type: (field.type || 'text') as FormField['type'],
    label,
    name: field.name || toFieldName(label),
    placeholder: field.placeholder || '',
    required: field.required ?? false,
    options: [...(field.options || [])],
    value: field.value ?? null,
    defaultValue: field.defaultValue ?? null,
    validations: field.validations ? { ...field.validations } : {},
    width: field.width ?? 12,
    order: order ?? field.order,
    condition: field.condition
      ? { ...field.condition }
      : { fieldId: '', value: '' },
  };
}

export function normalizeFieldOrder(schema: FormField[]): FormField[] {
  return schema.map((field, index) => sanitizeField(field, index + 1));
}
