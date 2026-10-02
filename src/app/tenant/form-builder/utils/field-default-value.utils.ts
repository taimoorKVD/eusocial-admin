import { DynamicField } from '../../../interfaces/dynamic-field';
import { FormField, OptionSource } from '../models/form-field.model';

/**
 * Configured default for Dynamic Users Select: resolve to the authenticated
 * tenant user's valueKey at form-fill time. No existing project sentinel found.
 */
export const CURRENT_USER_DEFAULT_TOKEN = '__current_user__';

type DefaultValueField = Pick<
  FormField | DynamicField,
  'type' | 'selectionType' | 'defaultValue' | 'value'
> & {
  optionSource?: OptionSource | DynamicField['optionSource'];
};

export function isDynamicUsersEndpoint(endpoint?: string | null): boolean {
  const normalized = String(endpoint ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .split('?')[0]
    .replace(/\/+$/, '')
    .replace(/_/g, '-');

  return normalized === 'users' || normalized === 'user';
}

export function isCurrentUserDefaultValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => isCurrentUserDefaultValue(item));
  }
  return String(value ?? '').trim() === CURRENT_USER_DEFAULT_TOKEN;
}

export function supportsCurrentUserDefault(field: DefaultValueField): boolean {
  return (
    field.type === 'select' &&
    field.optionSource?.type === 'dynamic' &&
    isDynamicUsersEndpoint(field.optionSource.endpoint)
  );
}

/**
 * Resolve Form Builder `defaultValue` for runtime init.
 * Replaces Current User token with the session user's configured valueKey.
 */
export function resolveConfiguredDefaultValue(
  field: DefaultValueField,
  sessionUser: Record<string, unknown> | null | undefined,
): unknown {
  const raw = field.defaultValue !== undefined ? field.defaultValue : field.value;

  if (!supportsCurrentUserDefault(field) || !isCurrentUserDefaultValue(raw)) {
    return raw;
  }

  const valueKey = String(field.optionSource?.response?.valueKey ?? 'id').trim() || 'id';
  const userValue =
    sessionUser?.[valueKey] ?? sessionUser?.['id'] ?? sessionUser?.['_id'];

  if (userValue == null || userValue === '') {
    return field.selectionType === 'multi' ? [] : '';
  }

  if (field.selectionType === 'multi') {
    if (Array.isArray(raw)) {
      return raw.map((item) =>
        isCurrentUserDefaultValue(item) ? userValue : item,
      );
    }
    return [userValue];
  }

  return userValue;
}
