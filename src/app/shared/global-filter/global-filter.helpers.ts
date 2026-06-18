import {
  GlobalFilterField,
  GlobalFilterOption,
  GlobalFilterValue,
} from './global-filter.types';

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

export function getSelectedOptionLabel(
  field: GlobalFilterField,
  filters: GlobalFilterValue,
): string {
  const selectedValue = filters[field.key];
  const option = field.options?.find((item) => String(item.id) === String(selectedValue));

  return option?.name ?? '-';
}

export function getSelectDisplayLabel(
  field: GlobalFilterField,
  filters: GlobalFilterValue,
): string {
  const selectedLabel = getSelectedOptionLabel(field, filters);

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
