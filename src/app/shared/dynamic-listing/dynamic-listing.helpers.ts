import { DynamicField, DynamicFieldOption } from '../../interfaces/dynamic-field';

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
      return rawValue ? 'Yes' : 'No';

    case 'select':
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

export function getListingImageSrc(record: Record<string, unknown>, field: DynamicField): string | null {
  const rawValue = getRecordFieldValue(record, field);

  if (typeof rawValue === 'string' && rawValue.trim()) {
    return rawValue;
  }

  return null;
}
