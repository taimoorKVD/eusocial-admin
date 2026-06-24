import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormField } from '../models/form-field.model';
import {
  cloneOptionSource,
  createFieldFromTemplate,
  generateFieldId,
  normalizeFieldOrder,
  sanitizeField,
  toFieldName,
} from './form-field.factory';

export function buildUniqueFieldName(
  baseName: string,
  schema: FormField[]
): string {
  const normalizedBase = baseName.trim() || 'field';
  const existingNames = new Set(
    schema
      .map(field => String(field.name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  if (!existingNames.has(normalizedBase.toLowerCase())) {
    return normalizedBase;
  }

  let suffix = 2;
  let candidate = `${normalizedBase}_${suffix}`;

  while (existingNames.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${normalizedBase}_${suffix}`;
  }

  return candidate;
}

export function applyCanvasDrop(
  event: CdkDragDrop<FormField[]>,
  schema: FormField[]
): { schema: FormField[]; insertedField?: FormField } {
  if (event.previousContainer === event.container) {
    const reordered = [...schema];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    return { schema: normalizeFieldOrder(reordered) };
  }

  const template = event.item.data as Partial<FormField>;
  const field = createFieldFromTemplate(template);
  const updated = [...schema];
  const insertIndex = Math.min(
    Math.max(event.currentIndex, 0),
    updated.length
  );

  updated.splice(insertIndex, 0, field);
  return {
    schema: normalizeFieldOrder(updated),
    insertedField: field,
  };
}

export function duplicateFormField(
  field: FormField,
  schema: FormField[]
): { schema: FormField[]; duplicate: FormField | null } {
  const index = schema.findIndex(item => item.id === field.id);
  if (index === -1) {
    return { schema, duplicate: null };
  }

  const duplicateLabel = `${field.label} Copy`;
  const duplicateName = buildUniqueFieldName(toFieldName(duplicateLabel), schema);

  const clone = createFieldFromTemplate({
    ...field,
    id: generateFieldId(),
    label: duplicateLabel,
    name: duplicateName,
    options: (field.options || []).map(option =>
      typeof option === 'string' ? option : { ...option }
    ),
    optionSource: cloneOptionSource(field.optionSource),
    condition: field.condition
      ? { ...field.condition }
      : { fieldId: '', value: '' },
    validations: field.validations ? { ...field.validations } : {},
  });

  return {
    schema: normalizeFieldOrder([
      ...schema.slice(0, index + 1),
      clone,
      ...schema.slice(index + 1),
    ]),
    duplicate: clone,
  };
}

export function removeFormField(
  field: FormField,
  schema: FormField[]
): FormField[] {
  const deleteIndex = schema.findIndex(item => item === field);
  const fallbackIndex = schema.findIndex(item => item.id === field.id);
  const targetIndex = deleteIndex >= 0 ? deleteIndex : fallbackIndex;

  if (targetIndex === -1) {
    return schema;
  }

  return normalizeFieldOrder([
    ...schema.slice(0, targetIndex),
    ...schema.slice(targetIndex + 1),
  ]);
}

export function updateFormField(
  updated: FormField,
  schema: FormField[]
): FormField[] {
  const index = schema.findIndex(field => field.id === updated.id);

  if (index === -1) {
    return schema;
  }

  const normalizedField = sanitizeField({
    ...updated,
    isShow: updated.isShow !== false,
    isReadonly: updated.isReadonly === true,
    options: [...(updated.options || [])],
    optionSource: updated.optionSource
      ? { ...updated.optionSource }
      : undefined,
    condition: updated.condition
      ? { ...updated.condition }
      : { fieldId: '', value: '' },
  });

  return normalizeFieldOrder(
    schema.map((field, fieldIndex) =>
      fieldIndex === index ? normalizedField : field
    )
  );
}

export function findFormField(
  schema: FormField[],
  fieldId: string | null
): FormField | null {
  if (!fieldId) {
    return null;
  }

  return schema.find(field => field.id === fieldId) || null;
}

export function getHiddenFormFields(schema: FormField[]): FormField[] {
  return schema.filter(field => field.isShow === false);
}
