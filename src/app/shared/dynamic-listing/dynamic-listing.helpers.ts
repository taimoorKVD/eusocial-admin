import { DynamicField, DynamicFieldOption, DynamicFieldType } from '../../interfaces/dynamic-field';
import { GlobalFilterField } from '../global-filter/global-filter';

const DEFAULT_NON_FILTERABLE_TYPES = new Set<DynamicFieldType>(['image']);

export interface FilterFieldMappingOptions {
  excludeTypes?: DynamicFieldType[];
  excludeNamePattern?: RegExp;
  excludeLabelPattern?: RegExp;
}

const NESTED_FIELD_MAP: Record<string, string> = {
  job_position_id: 'jobPosition',
  location_id: 'location',
  role_id: 'role',
};

export function sortListingFields(fields: DynamicField[]): DynamicField[] {
  return [...fields]
    .filter((field) => field.isShow !== false)
    .map((field, index) => ({ field, index }))
    .sort(
      (a, b) =>
        (a.field.order ?? a.index) - (b.field.order ?? b.index) || a.index - b.index,
    )
    .map(({ field }) => field);
}

export function getDefaultVisibleFieldIds(fields: DynamicField[], count = 4): string[] {
  return sortListingFields(fields)
    .slice(0, count)
    .map((field) => field.id);
}

export function getVisibleColumns(
  fields: DynamicField[],
  storageKey: string,
  defaultVisibleCount = 4,
): DynamicField[] {
  const { sortedFields, visibleFieldIds } = resolveInitialVisibleFieldIds(
    fields,
    storageKey,
    defaultVisibleCount,
  );
  const visibleSet = new Set(visibleFieldIds);

  return sortedFields.filter((field) => visibleSet.has(field.id));
}

export interface ResolvedColumnVisibility {
  sortedFields: DynamicField[];
  visibleFieldIds: string[];
  persistDefaults: boolean;
}

export function resolveInitialVisibleFieldIds(
  fields: DynamicField[],
  storageKey: string,
  defaultVisibleCount = 4,
): ResolvedColumnVisibility {
  const sortedFields = sortListingFields(fields || []);
  const savedIds = loadVisibleColumnIds(storageKey);
  const validSavedIds = savedIds?.filter((id) =>
    sortedFields.some((field) => field.id === id),
  );

  if (validSavedIds?.length) {
    return {
      sortedFields,
      visibleFieldIds: validSavedIds,
      persistDefaults: false,
    };
  }

  return {
    sortedFields,
    visibleFieldIds: getDefaultVisibleFieldIds(sortedFields, defaultVisibleCount),
    persistDefaults: true,
  };
}

export function getOrderedVisibleFieldIds(
  sortedFields: DynamicField[],
  visibleFieldIds: ReadonlySet<string>,
): string[] {
  return sortedFields
    .filter((field) => visibleFieldIds.has(field.id))
    .map((field) => field.id);
}

export function getListingBadgeClass(field: DynamicField): string {
  switch (field.type) {
    case 'checkbox':
    case 'radio':
      return 'border border-[#ea580c] hover:bg-orange-100';
    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200';
  }
}

export function splitCommaSeparatedValue(value: unknown): string[] {
  if (!value) {
    return [];
  }

  return value
    .toString()
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length);
}

export function getRecordTrackId(
  index: number,
  record: Record<string, unknown>,
): string | number {
  const id = record['id'];
  return typeof id === 'string' || typeof id === 'number' ? id : index;
}

export function loadVisibleColumnIds(storageKey: string): string[] | null {
  if (!storageKey) {
    return null;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

export function saveVisibleColumnIds(storageKey: string, fieldIds: string[]): void {
  if (!storageKey) {
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(fieldIds));
}

export function getOptionLabel(option: string | DynamicFieldOption): string {
  return typeof option === 'string' ? option : option.label;
}

export function getOptionValue(option: string | DynamicFieldOption, index = 0): string | number {
  return typeof option === 'string' ? option : (option.value ?? index);
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function readNestedValue(record: Record<string, unknown>, fieldName: string): unknown {
  const nestedKey = NESTED_FIELD_MAP[fieldName];
  if (!nestedKey) {
    return undefined;
  }

  const nested = record[nestedKey];
  if (!nested || typeof nested !== 'object') {
    return undefined;
  }

  const nestedRecord = nested as Record<string, unknown>;
  return nestedRecord['name'] ?? nestedRecord['label'] ?? nestedRecord['id'];
}

export function getRecordFieldValue(record: Record<string, unknown>, field: DynamicField): unknown {
  if (!record) {
    return undefined;
  }

  const fieldName = field.name;

  if (record[fieldName] !== undefined && record[fieldName] !== null && record[fieldName] !== '') {
    return record[fieldName];
  }

  const camelKey = snakeToCamel(fieldName);
  if (record[camelKey] !== undefined && record[camelKey] !== null && record[camelKey] !== '') {
    return record[camelKey];
  }

  const nestedValue = readNestedValue(record, fieldName);
  if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
    return nestedValue;
  }

  return record[fieldName];
}

export function formatListingCellValue(record: Record<string, unknown>, field: DynamicField): string {
  const rawValue = getRecordFieldValue(record, field);

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return '—';
  }

  switch (field.type) {
    case 'checkbox':
      {
      const values = getCheckboxValues(record, field);
      return values.length ? values.join(', ') : '—';
    }

    case 'select':
    {
      if (typeof rawValue === 'object' && rawValue !== null) {
        const obj = rawValue as Record<string, unknown>;
        return String(obj['name'] ?? obj['label'] ?? obj['id'] ?? '—');
      }

      const match = field.options?.find(
        option => String(getOptionValue(option)) === String(rawValue)
      );

      return match ? getOptionLabel(match) : String(rawValue);
    }

    case 'radio': {
      const match = field.options?.find(
        (option) => String(getOptionValue(option)) === String(rawValue),
      );
      return match ? getOptionLabel(match) : String(rawValue);
    }

    case 'image':
      return typeof rawValue === 'string' ? rawValue : '—';

    default:
      if (Array.isArray(rawValue)) {
        return rawValue.length ? rawValue.join(', ') : '—';
      }

      if (typeof rawValue === 'object') {
        const obj = rawValue as Record<string, unknown>;
        return String(obj['name'] ?? obj['label'] ?? obj['id'] ?? '—');
      }

      return String(rawValue);
  }
}

  export function getCheckboxValues(record: Record<string, unknown>, field: DynamicField): string[] {
    const value = record[field.name] ?? record[snakeToCamel(field.name)];

    if (!Array.isArray(value) || !field.options?.length) {
      return [];
    }

    return value
      .map((item) => {
        const option = field.options?.find((opt) =>
          typeof opt === 'string' ? opt === item : opt.value === item,
        );

        return typeof option === 'string' ? option : (option?.label ?? item);
      })
      .filter(Boolean) as string[];
  }

export function getListingImageSrc(record: Record<string, unknown>, field: DynamicField): string | null {
  const rawValue = getRecordFieldValue(record, field);

  if (typeof rawValue === 'string' && rawValue.trim()) {
    return rawValue;
  }

  return null;
}

export function mapVisibleColumnsToFilterFields(
  columns: DynamicField[],
  options?: FilterFieldMappingOptions,
): GlobalFilterField[] {
  return columns
    .filter((field) => !shouldExcludeFromFilter(field, options))
    .map((field) => ({
      key: field.name,
      label: field.label,
      type: mapDynamicFieldToFilterType(field),
      placeholder: field.placeholder || `Search by ${field.label.toLowerCase()}...`,
       options:
        field.type === 'radio'
          ? [
              { value: '', name: 'All' },
              ...(field.options || []).map((opt: any) => ({
                value: getOptionValue(opt),
                name: getOptionLabel(opt),
              })),
            ]
          : field.options,
      // options: mapDynamicFieldToFilterOptions(field),
    }));
}

export function shouldExcludeFromFilter(
  field: DynamicField,
  options?: FilterFieldMappingOptions,
): boolean {
  const excludedTypes = new Set(options?.excludeTypes ?? [...DEFAULT_NON_FILTERABLE_TYPES]);

  if (excludedTypes.has(field.type)) {
    return true;
  }

  if (options?.excludeNamePattern?.test(field.name)) {
    return true;
  }

  if (options?.excludeLabelPattern?.test(field.label)) {
    return true;
  }

  return false;
}

export function pruneFiltersByAllowedKeys(
  filters: Record<string, unknown>,
  allowedKeys: Set<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([key, value]) => allowedKeys.has(key) && value !== undefined && value !== null && value !== '',
    ),
  );
}

function mapDynamicFieldToFilterType(field: DynamicField): string {
  switch (field.type) {
    case 'select':
       return 'select';
    case 'radio':
      return 'radio';
    case 'checkbox':
      return 'checkbox';
    case 'number':
      return 'number';
    case 'email':
      return 'email';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

function mapDynamicFieldToFilterOptions(
  field: DynamicField,
): GlobalFilterField['options'] | undefined {
  if (field.type === 'checkbox') {
    return [
      { id: 1, name: 'Yes' },
      { id: 0, name: 'No' },
    ];
  }

  if (field.type !== 'select' && field.type !== 'radio') {
    return undefined;
  }

  if (!field.options?.length) {
    return undefined;
  }

  return field.options.map((option, index) => ({
    id: getOptionValue(option, index),
    name: getOptionLabel(option),
  }));
}
