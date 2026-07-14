import {
  FilterLocationFields,
  FilterLocationKind,
  GlobalFilterField,
  GlobalFilterOption,
  GlobalFilterValue,
} from './global-filter.types';

/** Initial / incremental page size for State and City filter dropdowns. */
export const LOCATION_FILTER_OPTION_PAGE_SIZE = 100;

export function hasActiveFilterValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return !!value;
}

export function getOptionLabel(option: GlobalFilterOption | string | number): string {
  return typeof option === 'object'
    ? (option.label ?? option.name ?? String(option))
    : String(option);
}

export function getOptionValue(option: GlobalFilterOption | string | number): unknown {
  return typeof option === 'object' ? (option.value ?? option.id ?? option) : option;
}

export function filterOptionsByQuery(
  options: GlobalFilterOption[],
  query: string,
): GlobalFilterOption[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) =>
    (option.name ?? option.label ?? '').toLowerCase().includes(normalizedQuery),
  );
}

export function resolveFilterLocationEndpoint(
  endpoint?: string | null,
): FilterLocationKind | null {
  if (!endpoint) {
    return null;
  }

  const normalized = endpoint
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .split('?')[0]
    .replace(/\/+$/, '')
    .replace(/_/g, '-');

  if (
    normalized === 'countries' ||
    normalized === 'states' ||
    normalized === 'cities'
  ) {
    return normalized;
  }

  return null;
}

export function getFilterLocationFields(
  fields: GlobalFilterField[],
): FilterLocationFields {
  let country: GlobalFilterField | null = null;
  let state: GlobalFilterField | null = null;
  let city: GlobalFilterField | null = null;

  for (const field of fields) {
    if (field.type !== 'select') {
      continue;
    }

    const kind = resolveFilterLocationEndpoint(field.endpoint);

    if (kind === 'countries' && !country) {
      country = field;
    } else if (kind === 'states' && !state) {
      state = field;
    } else if (kind === 'cities' && !city) {
      city = field;
    }
  }

  return { country, state, city };
}

/** Only State and City selects use progressive option loading. */
export function isPaginatedLocationFilterField(field: GlobalFilterField): boolean {
  if (field.type !== 'select') {
    return false;
  }

  const kind = resolveFilterLocationEndpoint(field.endpoint);
  return kind === 'states' || kind === 'cities';
}

export function getVisibleFilterOptions(
  options: GlobalFilterOption[],
  field: GlobalFilterField,
  query: string,
  visibleLimit: number,
): GlobalFilterOption[] {
  const filtered = filterOptionsByQuery(options, query);

  if (!isPaginatedLocationFilterField(field) || query.trim()) {
    return filtered;
  }

  return filtered.slice(0, Math.max(visibleLimit, LOCATION_FILTER_OPTION_PAGE_SIZE));
}

export function hasMoreFilterOptions(
  options: GlobalFilterOption[],
  field: GlobalFilterField,
  query: string,
  visibleLimit: number,
): boolean {
  if (!isPaginatedLocationFilterField(field) || query.trim()) {
    return false;
  }

  return filterOptionsByQuery(options, query).length > visibleLimit;
}

export function mapLocationRecordsToFilterOptions(
  field: GlobalFilterField,
  records: any[],
): GlobalFilterOption[] {
  const labelKey = field.labelKey ?? 'name';
  const valueKey = field.valueKey ?? 'id';

  return (records ?? [])
    .map((record) => {
      const id = record?.[valueKey];
      const name = String(record?.[labelKey] ?? '');

      if (id == null || id === '') {
        return null;
      }

      return {
        id,
        name,
        label: name,
        value: id,
      } as GlobalFilterOption;
    })
    .filter((option): option is GlobalFilterOption => option !== null);
}

export function getSelectedOptionLabel(
  field: GlobalFilterField,
  filters: GlobalFilterValue,
  options: GlobalFilterOption[] = field.options ?? [],
): string {
  const selectedValue = filters[field.key];
  const option = options.find((item) => String(item.id) === String(selectedValue));

  return option?.name ?? '-';
}

export function getSelectDisplayLabel(
  field: GlobalFilterField,
  filters: GlobalFilterValue,
  options?: GlobalFilterOption[],
): string {
  const selectedLabel = getSelectedOptionLabel(field, filters, options);

  if (selectedLabel !== '-') {
    return selectedLabel;
  }

  return field.placeholder ?? `Select ${field.label}`;
}

export function pruneFilterStateByKeys<T extends Record<string, unknown>>(
  state: T,
  allowedKeys: Set<string>,
): T {
  return Object.fromEntries(
    Object.entries(state).filter(([key]) => allowedKeys.has(key)),
  ) as T;
}

export function syncFiltersWithFields(
  fields: GlobalFilterField[],
  filters: GlobalFilterValue,
): GlobalFilterValue {
  const allowedKeys = new Set(fields.map((field) => field.key));
  const nextFilters = pruneFilterStateByKeys(filters, allowedKeys);

  fields.forEach((field) => {
    if (
      field.type === 'radio' &&
      nextFilters[field.key] === undefined &&
      field.options?.some((option) => getOptionValue(option) === '')
    ) {
      nextFilters[field.key] = '';
    }
  });

  return nextFilters;
}

export function buildClearedFilters(fields: GlobalFilterField[]): GlobalFilterValue {
  const cleared: GlobalFilterValue = {};

  fields.forEach((field) => {
    if (field.type !== 'radio') {
      return;
    }

    const allOption = field.options?.find((option) => getOptionValue(option) === '');
    cleared[field.key] = allOption ? '' : undefined;
  });

  return cleared;
}

export function sanitizeNumericInput(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function toggleCheckboxFilterValue(
  filters: GlobalFilterValue,
  fieldKey: string,
  option: GlobalFilterOption | string | number,
  checked: boolean,
): GlobalFilterValue {
  const value = getOptionValue(option);
  const existing = Array.isArray(filters[fieldKey]) ? [...(filters[fieldKey] as unknown[])] : [];

  return {
    ...filters,
    [fieldKey]: checked ? [...existing, value] : existing.filter((item) => item !== value),
  };
}

export function isCheckboxOptionSelected(
  filters: GlobalFilterValue,
  fieldKey: string,
  option: GlobalFilterOption | string | number,
): boolean {
  const value = getOptionValue(option);
  const selected = Array.isArray(filters[fieldKey]) ? (filters[fieldKey] as unknown[]) : [];

  return selected.includes(value);
}

export function isEmptyFilterValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}
