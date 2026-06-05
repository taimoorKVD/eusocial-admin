import { FieldOption } from '../models/form-field.model';

export function normalizeFieldOption(option: unknown): FieldOption | null {
  if (typeof option === 'string' || typeof option === 'number') {
    const text = String(option);
    return { label: text, value: text };
  }

  if (!option || typeof option !== 'object') {
    return null;
  }

  const record = option as Record<string, unknown>;
  const label = record['label'];
  const value = record['value'];

  if (label != null && value != null) {
    return {
      label: String(label),
      value: value as string | number,
    };
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
