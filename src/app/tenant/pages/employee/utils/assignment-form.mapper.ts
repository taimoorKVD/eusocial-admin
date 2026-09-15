import { FormField } from '../../../form-builder/models/form-field.model';
import {
  FormFieldConfig,
  FormSection,
} from '../../extra-management/forms/models/dynamic-form.models';
import { mapConfigFieldToBuilder } from '../../extra-management/forms/utils/field-builder-adapter.utils';

export interface AssignmentSectionBuilder {
  id: string;
  name: string;
  builderFields: FormField[];
  /** Builder fields preserved per API row (section.rows -> row.fields). */
  builderRows: FormField[][];
}

/**
 * Map assignment schema sections into builder fields.
 * Answers are applied by field.id only (backend answer keys).
 * `builderRows` keeps the API's logical row grouping for the Regular Form layout.
 */
export function mapAssignmentSectionsToBuilder(
  sections: FormSection[],
  schema: Record<string, unknown> = {},
  answers: Record<string, unknown> = {},
): AssignmentSectionBuilder[] {
  const fromSections = (sections || [])
    .map((section, sectionIndex) => {
      const { fields, rows } = buildSectionBuilder(section, sectionIndex, answers);

      return {
        id: String(section?.id ?? `section_${sectionIndex}`),
        name: String(section?.name ?? `Section ${sectionIndex + 1}`),
        builderFields: fields,
        builderRows: rows,
      };
    })
    .filter((section) => section.builderFields.length > 0);

  if (fromSections.length) {
    return fromSections;
  }

  const fallback = extractFallbackFields(schema).map((field, index) =>
    toBuilderField(applyAnswer(field, answers), 0, index),
  );

  if (!fallback.length) {
    return [];
  }

  return [
    {
      id: 'section_default',
      name: 'Form',
      builderFields: fallback,
      builderRows: [fallback],
    },
  ];
}

function buildSectionBuilder(
  section: FormSection,
  sectionIndex: number,
  answers: Record<string, unknown>,
): { fields: FormField[]; rows: FormField[][] } {
  const fields: FormField[] = [];
  const rows: FormField[][] = [];

  for (const row of section?.rows || []) {
    const rowFields: FormField[] = [];
    for (const field of row?.fields || []) {
      if (field && typeof field === 'object') {
        const builder = toBuilderField(
          applyAnswer(field as FormFieldConfig, answers),
          sectionIndex,
          fields.length,
        );
        fields.push(builder);
        rowFields.push(builder);
      }
    }
    rows.push(rowFields);
  }

  return { fields, rows };
}

function applyAnswer(
  field: FormFieldConfig,
  answers: Record<string, unknown>,
): FormFieldConfig {
  if (!field.id || !Object.prototype.hasOwnProperty.call(answers, field.id)) {
    return field;
  }

  const answer = answers[field.id];
  const isMultiSelect =
    field.type === 'select' &&
    (field.selectionType === 'multi' ||
      String((field as { selection_type?: string }).selection_type || '')
        .trim()
        .toLowerCase() === 'multi' ||
      String((field as { selection_type?: string }).selection_type || '')
        .trim()
        .toLowerCase() === 'multiple');

  if (isMultiSelect) {
    const values = Array.isArray(answer)
      ? answer.map(String)
      : answer == null || answer === ''
        ? []
        : [String(answer)];

    return {
      ...field,
      value: values,
      defaultValue: values,
    };
  }

  return {
    ...field,
    value: normalizeDisplayValue(answer),
    defaultValue: answer,
  };
}

function normalizeDisplayValue(answer: unknown): string {
  if (answer == null) {
    return '';
  }
  if (Array.isArray(answer)) {
    return answer.map(String).join(',');
  }
  if (typeof answer === 'boolean') {
    return answer ? 'true' : 'false';
  }
  return String(answer);
}

function extractFallbackFields(schema: Record<string, unknown>): FormFieldConfig[] {
  const candidates = [schema['fields'], schema['formFields'], schema['form_fields']];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((field) => field && typeof field === 'object') as FormFieldConfig[];
    }
  }
  return [];
}

function toBuilderField(
  field: FormFieldConfig,
  sectionIndex: number,
  fieldIndex: number,
): FormField {
  const builder = mapConfigFieldToBuilder({
    ...field,
    id: field.id || field.name || `field_${sectionIndex}_${fieldIndex}`,
  });

  return {
    ...builder,
    value: field.defaultValue ?? field.value ?? builder.value,
    defaultValue: field.defaultValue ?? field.value ?? builder.defaultValue,
    order: fieldIndex,
  };
}
