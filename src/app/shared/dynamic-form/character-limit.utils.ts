/**
 * Character limits for Form Builder Text Field and Text Area only.
 * Missing/invalid values fall back to these defaults for backward compatibility.
 * Configured limits cannot exceed these maxima.
 */
export const DEFAULT_TEXT_CHARACTER_LIMIT = 255;
export const DEFAULT_TEXTAREA_CHARACTER_LIMIT = 5000;

export function supportsCharacterLimit(type?: string | null): boolean {
  return type === 'text' || type === 'textarea';
}

export function getDefaultCharacterLimit(type: string): number {
  return type === 'textarea'
    ? DEFAULT_TEXTAREA_CHARACTER_LIMIT
    : DEFAULT_TEXT_CHARACTER_LIMIT;
}

/** Hard upper bound for the Form Builder character-limit setting (same as defaults). */
export function getMaxCharacterLimit(type: string): number {
  return getDefaultCharacterLimit(type);
}

export function getCharacterLimitExceededMessage(type: string): string {
  if (type === 'textarea') {
    return 'Maximum character limit for Text Area is 5000.';
  }

  return 'Maximum character limit for Text Field is 255.';
}

function parseCharacterLimitInput(raw: unknown): number {
  if (typeof raw === 'number') {
    return raw;
  }

  if (typeof raw === 'string' && raw.trim() !== '') {
    return Number(raw);
  }

  return NaN;
}

/** True when the raw input is a finite number above the type maximum. */
export function isCharacterLimitAboveMaximum(
  type: string | null | undefined,
  raw: unknown,
): boolean {
  if (!supportsCharacterLimit(type)) {
    return false;
  }

  const numeric = parseCharacterLimitInput(raw);
  return Number.isFinite(numeric) && numeric > getMaxCharacterLimit(type as string);
}

/**
 * Resolve a positive integer character limit for text/textarea.
 * Invalid or missing values use the type default.
 * Values above the type maximum are clamped to that maximum.
 */
export function resolveCharacterLimit(
  type: string | null | undefined,
  raw: unknown,
): number | undefined {
  if (!supportsCharacterLimit(type)) {
    return undefined;
  }

  const max = getMaxCharacterLimit(type as string);
  const numeric = parseCharacterLimitInput(raw);

  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 1) {
    return max;
  }

  return Math.min(numeric, max);
}

/** Effective maxlength for a field, or null when the type does not support limits. */
export function getFieldCharacterLimit(
  field: { type?: string; characterLimit?: number } | null | undefined,
): number | null {
  if (!field || !supportsCharacterLimit(field.type)) {
    return null;
  }

  return resolveCharacterLimit(field.type, field.characterLimit) ?? null;
}

export function truncateToCharacterLimit(value: string, limit: number): string {
  if (limit < 1 || value.length <= limit) {
    return value;
  }

  return value.slice(0, limit);
}
