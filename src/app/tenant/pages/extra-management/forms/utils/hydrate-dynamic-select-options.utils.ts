import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { DynamicField } from '../../../../../interfaces/dynamic-field';
import { loadDynamicDropdownOptions } from '../../../../../shared/dynamic-listing/dynamic-field-options.loader';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { FormFieldConfig, FormSelectOption, FormSection } from '../models/dynamic-form.models';

/**
 * Resolve saved dynamic Select option IDs to `{ label, value }` for Form Template UI.
 * Reuses the same API + valueKey/labelKey intersection as form-fill (`loadDynamicDropdownOptions`).
 * Payload save still strips back to IDs via `stripFieldId`.
 */
export function hydrateFormTemplateDynamicSelectOptions(
  formStorageService: FormStorageService,
  sections: FormSection[],
): Observable<FormSection[]> {
  const fieldsNeedingHydration: FormFieldConfig[] = [];

  for (const section of sections) {
    for (const row of section.rows) {
      for (const field of row.fields) {
        if (needsDynamicSelectLabelHydration(field)) {
          fieldsNeedingHydration.push(field);
        }
      }
    }
  }

  if (!fieldsNeedingHydration.length) {
    return of(sections);
  }

  const dynamicFields = fieldsNeedingHydration.map(toDynamicFieldForHydration);

  return loadDynamicDropdownOptions(formStorageService, dynamicFields).pipe(
    map(() => {
      const hydratedById = new Map(
        dynamicFields.map((field) => [field.id, toConfigSelectOptions(field.options)]),
      );

      return sections.map((section) => ({
        ...section,
        rows: section.rows.map((row) => ({
          ...row,
          fields: row.fields.map((field) => {
            const options = hydratedById.get(field.id);
            return options ? { ...field, options } : field;
          }),
        })),
      }));
    }),
  );
}

export function hydrateFormTemplateDynamicSelectField(
  formStorageService: FormStorageService,
  field: FormFieldConfig,
): Observable<FormFieldConfig> {
  if (!needsDynamicSelectLabelHydration(field)) {
    return of(field);
  }

  const dynamicField = toDynamicFieldForHydration(field);

  return loadDynamicDropdownOptions(formStorageService, [dynamicField]).pipe(
    map(() => ({
      ...field,
      options: toConfigSelectOptions(dynamicField.options),
    })),
  );
}

function needsDynamicSelectLabelHydration(field: FormFieldConfig): boolean {
  if (field.type !== 'select' || field.optionSource?.type !== 'dynamic') {
    return false;
  }

  if (!field.optionSource.endpoint || !field.options?.length) {
    return false;
  }

  // Already label+value objects — nothing to resolve.
  return field.options.some(
    (option) => typeof option === 'string' || typeof option === 'number',
  );
}

function toDynamicFieldForHydration(field: FormFieldConfig): DynamicField {
  return {
    id: field.id,
    name: field.name,
    type: 'select',
    label: field.label,
    options: field.options as DynamicField['options'],
    optionSource: field.optionSource
      ? {
          type: 'dynamic',
          endpoint: field.optionSource.endpoint,
          response: {
            labelKey: field.optionSource.response?.labelKey || 'name',
            valueKey: field.optionSource.response?.valueKey || 'id',
            dataPath: field.optionSource.response?.dataPath || 'data',
          },
        }
      : undefined,
    selectionType: field.selectionType,
  };
}

function toConfigSelectOptions(
  options: DynamicField['options'],
): FormSelectOption[] {
  return (options ?? []).map((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      return option;
    }

    return {
      label: String(option.label),
      value: option.value,
    };
  });
}
