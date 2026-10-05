import { FieldOption } from '../models/form-field.model';

function slugifyOptionValue(value: string | number): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeFieldOption(option: unknown): FieldOption | null {
  if (typeof option === 'string' || typeof option === 'number') {
    const text = String(option);
    return { label: text, value: text };
  }

  if (!option || typeof option !== 'object') {
    return null;
  }

  const record = option as Record<string, unknown>;
  const label = record['label'] ?? record['name'] ?? record['title'];
  const value = record['value'] ?? record['key'] ?? record['id'];

  if (label != null && value != null) {
    const normalized: FieldOption = {
      label: String(label),
      value: value as string | number,
    };

    if (typeof record['id'] === 'number') {
      normalized.id = record['id'] as number;
    }

    if (typeof record['sortOrder'] === 'number') {
      normalized.sortOrder = record['sortOrder'] as number;
    }

    if (typeof record['isDefault'] === 'boolean') {
      normalized.isDefault = record['isDefault'] as boolean;
    }

    return normalized;
  }

  if (label != null) {
    const text = String(label);
    return { label: text, value: text };
  }

  if (value != null) {
    return { label: String(value), value: value as string | number };
  }

  return null;
}

export function normalizeFieldOptions(
  options: unknown[] | undefined | null
): FieldOption[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map(option => normalizeFieldOption(option))
    .filter((option): option is FieldOption => option !== null);
}

export function normalizeStaticSelectFieldOptions(
  options: unknown[] | undefined | null
): FieldOption[] {
  if (!Array.isArray(options)) {
    return [];
  }

  const labels: string[] = [];

  for (const option of options) {
    let label: string | null = null;

    if (typeof option === 'string') {
      label = option.trim() || null;
    } else {
      const normalized = normalizeFieldOption(option);
      label = normalized?.label?.trim() || null;
    }

    if (label) {
      labels.push(label);
    }
  }

  return labels.map((label, index) => ({
    id: index + 1,
    label,
    value: slugifyOptionValue(label) || `option_${index + 1}`,
    sortOrder: index,
  }));
}

/**
 * Persist dynamic select selections as configured `valueKey` values.
 * Accepts bare ids or FieldOption objects and returns only the value list.
 */
export function toDynamicSelectOptionIds(
  options: unknown[] | undefined | null
): Array<string | number> {
  if (!Array.isArray(options)) {
    return [];
  }

  const ids: Array<string | number> = [];

  for (const option of options) {
    if (typeof option === 'number') {
      ids.push(option);
      continue;
    }

    if (typeof option === 'string') {
      if (option !== '') {
        ids.push(option);
      }
      continue;
    }

    const normalized = normalizeFieldOption(option);
    if (normalized?.value != null && normalized.value !== '') {
      ids.push(normalized.value);
    }
  }

  return ids;
}

export function normalizeCheckboxFieldOptions(
  options: unknown[] | undefined | null
): FieldOption[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map(option => normalizeFieldOption(option))
    .filter((option): option is FieldOption => option !== null)
    .map((normalized, index) => {
      const value =
        typeof normalized.value === 'string'
          ? slugifyOptionValue(normalized.value) || String(index + 1)
          : normalized.value;

      return {
        ...normalized,
        value,
        id: index + 1,
        sortOrder: index + 1,
        isDefault: normalized.isDefault ?? false,
      };
    });
}
