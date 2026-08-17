import { FormField } from '../../../form-builder/models/form-field.model';
import {
  FormFieldConfig,
  FormSection,
} from '../../extra-management/forms/models/dynamic-form.models';
import { mapConfigFieldToBuilder } from '../../extra-management/forms/utils/field-builder-adapter.utils';
import { EmployeeAssignmentSectionView } from '../../../../interfaces/employee-assignment';

/**
 * Map assignment schema sections into builder fields.
 * Answers are applied by field.id only (backend answer keys).
 */
export function mapAssignmentSectionsToBuilder(
  sections: FormSection[],
  schema: Record<string, unknown> = {},
  answers: Record<string, unknown> = {},
): Array<Omit<EmployeeAssignmentSectionView, 'fields'>> {
  const fromSections = (sections || [])
    .map((section, sectionIndex) => {
      const fields = flattenSectionFields(section).map((field, fieldIndex) =>
        toBuilderField(applyAnswer(field, answers), sectionIndex, fieldIndex),
      );

      return {
        id: String(section?.id ?? `section_${sectionIndex}`),
        name: String(section?.name ?? `Section ${sectionIndex + 1}`),
        builderFields: fields,
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

  return [{ id: 'section_default', name: 'Form', builderFields: fallback }];
}

function applyAnswer(
  field: FormFieldConfig,
  answers: Record<string, unknown>,
): FormFieldConfig {
  if (!field.id || !Object.prototype.hasOwnProperty.call(answers, field.id)) {
    return field;
  }

  const answer = answers[field.id];
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

function flattenSectionFields(section: FormSection): FormFieldConfig[] {
  const fields: FormFieldConfig[] = [];
  for (const row of section?.rows || []) {
    for (const field of row?.fields || []) {
      if (field && typeof field === 'object') {
        fields.push(field as FormFieldConfig);
      }
    }
  }
  return fields;
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
