import { FormField } from '../models/form-field.model';

export function normalizeDynamicModuleSlug(
  slug?: string | null
): string {
  return String(slug ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .split('?')[0]
    .replace(/\/+$/, '')
    .replace(/_/g, '-');
}

export function getFieldDynamicModuleSlug(
  field: FormField
): string | null {
  if (field.type !== 'select') {
    return null;
  }

  if (field.optionSource?.type !== 'dynamic') {
    return null;
  }

  const slug = normalizeDynamicModuleSlug(field.optionSource.endpoint);
  return slug || null;
}

/** True when another Select field in the schema already uses this Dynamic Module. */
export function isDynamicModuleAlreadyUsed(
  moduleSlug: string,
  schema: FormField[],
  excludeFieldId?: string
): boolean {
  const target = normalizeDynamicModuleSlug(moduleSlug);

  if (!target) {
    return false;
  }

  return schema.some(field => {
    if (excludeFieldId && field.id === excludeFieldId) {
      return false;
    }

    const usedSlug = getFieldDynamicModuleSlug(field);
    if (!usedSlug) {
      return false;
    }

    return (
      usedSlug === target ||
      usedSlug.replace(/-/g, '') === target.replace(/-/g, '')
    );
  });
}

export function isUniqueDynamicModuleOptionDisabled(
  moduleSlug: string,
  schema: FormField[],
  excludeFieldId?: string
): boolean {
  return isDynamicModuleAlreadyUsed(moduleSlug, schema, excludeFieldId);
}
