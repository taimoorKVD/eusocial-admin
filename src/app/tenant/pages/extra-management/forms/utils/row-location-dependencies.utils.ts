import {
  getFieldLocationKind,
  resolveBuilderLocationKind,
  type BuilderLocationKind,
} from '../../../../form-builder/utils/location-field-dependencies.utils';
import { FormFieldConfig, FormSelectOption } from '../models/dynamic-form.models';
import { mapConfigFieldToBuilder } from './field-builder-adapter.utils';

export interface RowLocationFields {
  country: FormFieldConfig | null;
  state: FormFieldConfig | null;
  city: FormFieldConfig | null;
}

export function getConfigFieldLocationKind(
  field: FormFieldConfig,
): BuilderLocationKind | null {
  return getFieldLocationKind(mapConfigFieldToBuilder(field));
}

/** True when a select field currently has a non-empty selection. */
export function hasSelectFieldValue(value: FormFieldConfig['value']): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => String(item ?? '').trim().length > 0);
  }

  return String(value ?? '').trim().length > 0;
}

/** Locate Country / State / City selects within a single Form Details row. */
export function getRowLocationFields(fields: FormFieldConfig[]): RowLocationFields {
  let country: FormFieldConfig | null = null;
  let state: FormFieldConfig | null = null;
  let city: FormFieldConfig | null = null;

  for (const field of fields) {
    if (field.type !== 'select') continue;

    const kind = getConfigFieldLocationKind(field);
    if (kind === 'countries' && !country) country = field;
    else if (kind === 'states' && !state) state = field;
    else if (kind === 'cities' && !city) city = field;
  }

  return { country, state, city };
}

/**
 * Clear dependent State/City option lists until their parent is selected.
 * Same idea as `app-dynamic-form` / Global Filter location overrides.
 */
export function clearDependentLocationOptions(
  fields: FormFieldConfig[],
): FormFieldConfig[] {
  const { country, state, city } = getRowLocationFields(fields);

  return fields.map((field) => {
    if (state && country && field.id === state.id) {
      return {
        ...field,
        options: [],
        value: hasSelectFieldValue(country.value) ? field.value : '',
      };
    }

    if (city && field.id === city.id) {
      if (state) {
        return {
          ...field,
          options: [],
          value: hasSelectFieldValue(state.value) ? field.value : '',
        };
      }

      if (country) {
        return {
          ...field,
          options: [],
          value: hasSelectFieldValue(country.value) ? field.value : '',
        };
      }
    }

    return field;
  });
}

/** True when a dependent location select should be non-interactive. */
export function isDependentLocationSelectLocked(field: FormFieldConfig): boolean {
  const kind = getConfigFieldLocationKind(field);
  if (kind !== 'states' && kind !== 'cities') {
    return false;
  }
  return !(field.options?.length);
}

export function getSelectOptionLabel(option: FormSelectOption): string {
  return typeof option === 'string' ? option : String(option.label ?? option.value ?? '');
}

export function getSelectOptionValue(option: FormSelectOption): string {
  return typeof option === 'string' ? option : String(option.value ?? option.label ?? '');
}

/** Map location API/cache records to id-based select options (matches app-dynamic-form). */
export function mapLocationRecordsToSelectOptions(
  records: any[],
  labelKey = 'name',
  valueKey = 'id',
): FormSelectOption[] {
  return (records ?? [])
    .map((record) => {
      const value = record?.[valueKey];
      const label = String(record?.[labelKey] ?? record?.name ?? '').trim();
      if (value == null || value === '' || !label) {
        return null;
      }
      return { label, value: value as string | number };
    })
    .filter((option): option is { label: string; value: string | number } => option != null);
}

/**
 * Resolve a selected dropdown value to a location record id.
 * Accepts either a raw id or a display label (legacy baked options).
 */
export function resolveLocationRecordId(
  selectedValue: string,
  records: any[],
  labelKey = 'name',
  valueKey = 'id',
): unknown {
  const raw = String(selectedValue ?? '').trim();
  if (!raw) return null;

  const byId = records.find((record) => String(record?.[valueKey]) === raw);
  if (byId) return byId[valueKey];

  const byLabel = records.find(
    (record) => String(record?.[labelKey] ?? record?.name ?? '').trim() === raw,
  );
  return byLabel?.[valueKey] ?? null;
}

export function getFieldOptionLabelKey(field: FormFieldConfig): string {
  return field.optionSource?.response?.labelKey ?? 'name';
}

export function getFieldOptionValueKey(field: FormFieldConfig): string {
  return field.optionSource?.response?.valueKey ?? 'id';
}

export function isLocationEndpoint(endpoint?: string | null): boolean {
  return resolveBuilderLocationKind(endpoint) != null;
}

export function isEmptyLocationValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return !value.some((item) => String(item ?? '').trim().length > 0);
  }

  return String(value).trim() === '';
}
