/** Default max stars when Form Builder omits maxRating. */
export const DEFAULT_MAX_RATING = 5;

const ALLOWED_MAX_RATINGS = new Set([3, 5, 7, 10]);

export function normalizeMaxRating(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);

  if (Number.isFinite(numeric) && ALLOWED_MAX_RATINGS.has(numeric)) {
    return numeric;
  }

  return DEFAULT_MAX_RATING;
}

/**
 * Coerce a stored/control value to a finite integer rating within 1..maxRating,
 * or null when empty / invalid.
 */
export function normalizeRatingValue(
  value: unknown,
  maxRating: number = DEFAULT_MAX_RATING,
): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.round(numeric);
  const max = normalizeMaxRating(maxRating);

  if (rounded < 1 || rounded > max) {
    return null;
  }

  return rounded;
}

/** Build 1..maxRating indices for star loops. */
export function getRatingStarValues(maxRating: number = DEFAULT_MAX_RATING): number[] {
  const max = normalizeMaxRating(maxRating);
  return Array.from({ length: max }, (_, index) => index + 1);
}

/**
 * Compact listing display: filled ★ / empty ☆ for the numeric rating.
 * Example: 4 of 5 → ★★★★☆
 */
export function formatRatingStars(
  value: unknown,
  maxRating: number = DEFAULT_MAX_RATING,
): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '—';
  }

  const max = normalizeMaxRating(maxRating);
  const rating = Math.min(Math.max(Math.round(numeric), 0), max);

  if (rating <= 0) {
    return '—';
  }

  return '★'.repeat(rating) + '☆'.repeat(max - rating);
}
