import { FormField } from '../models/form-field.model';

export type BuilderLocationKind = 'countries' | 'states' | 'cities';

export function resolveBuilderLocationKind(
  endpoint?: string | null
): BuilderLocationKind | null {
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

export function getFieldLocationKind(
  field: FormField
): BuilderLocationKind | null {
  if (field.optionSource?.type !== 'dynamic') {
    return null;
  }

  return resolveBuilderLocationKind(field.optionSource.endpoint);
}

export function schemaHasLocationKind(
  schema: FormField[],
  kind: BuilderLocationKind,
  excludeFieldId?: string
): boolean {
  return schema.some(
    field =>
      (!excludeFieldId || field.id !== excludeFieldId) &&
      getFieldLocationKind(field) === kind
  );
}

export function getLocationPresence(schema: FormField[]): {
  hasCountry: boolean;
  hasState: boolean;
  hasCity: boolean;
} {
  return {
    hasCountry: schemaHasLocationKind(schema, 'countries'),
    hasState: schemaHasLocationKind(schema, 'states'),
    hasCity: schemaHasLocationKind(schema, 'cities'),
  };
}

/** States and Cities stay disabled in Dynamic Options until a Country field exists. */
export function isLocationModuleOptionDisabled(
  moduleSlug: string,
  schema: FormField[],
  excludeFieldId?: string
): boolean {
  const kind = resolveBuilderLocationKind(moduleSlug);

  if (kind !== 'states' && kind !== 'cities') {
    return false;
  }

  return !schemaHasLocationKind(schema, 'countries', excludeFieldId);
}

/**
 * Dynamic Select "Select Options" filtering is not used for location modules
 * (Countries / States / Cities). Those keep the existing cascade behavior.
 */
export function isDynamicSelectOptionsHiddenForModule(
  moduleSlug?: string | null
): boolean {
  return resolveBuilderLocationKind(moduleSlug) != null;
}

export function getLocationFieldDeleteBlockReason(
  field: FormField,
  schema: FormField[]
): string | null {
  const kind = getFieldLocationKind(field);

  if (!kind) {
    return null;
  }

  const hasState = schemaHasLocationKind(schema, 'states', field.id);
  const hasCity = schemaHasLocationKind(schema, 'cities', field.id);

  if (kind === 'countries' && (hasState || hasCity)) {
    if (hasState && hasCity) {
      return 'Please remove the State and City fields before deleting the Country field.';
    }

    if (hasState) {
      return 'Please remove the State field before deleting the Country field.';
    }

    return 'Please remove the City field before deleting the Country field.';
  }

  if (kind === 'states' && hasCity) {
    return 'Please remove the City field before deleting the State field.';
  }

  return null;
}
