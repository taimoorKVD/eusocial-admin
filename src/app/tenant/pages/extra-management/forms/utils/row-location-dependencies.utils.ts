import {
  getFieldLocationKind,
  resolveBuilderLocationKind,
  type BuilderLocationKind,
} from '../../../../form-builder/utils/location-field-dependencies.utils';
import { FormFieldConfig } from '../models/dynamic-form.models';
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

export function mapLocationRecordsToOptionLabels(
  records: any[],
  labelKey = 'name',
): string[] {
  return (records ?? [])
    .map((record) => String(record?.[labelKey] ?? record?.name ?? '').trim())
    .filter(Boolean);
}

/** Resolve a selected dropdown value (id or label) to a location record id. */
export function resolveLocationRecordId(
  selectedValue: string,
  records: any[],
  labelKey = 'name',
): unknown {
  const raw = String(selectedValue ?? '').trim();
  if (!raw) return null;

  const byId = records.find((record) => String(record?.id) === raw);
  if (byId) return byId.id;

  const byLabel = records.find(
    (record) => String(record?.[labelKey] ?? record?.name ?? '').trim() === raw,
  );
  return byLabel?.id ?? null;
}

export function getFieldOptionLabelKey(field: FormFieldConfig): string {
  return field.optionSource?.response?.labelKey ?? 'name';
}

export function isLocationEndpoint(endpoint?: string | null): boolean {
  return resolveBuilderLocationKind(endpoint) != null;
}
