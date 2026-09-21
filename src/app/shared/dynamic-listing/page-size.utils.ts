/** Standard Tenant Admin listing page-size choices. */
export const PAGE_SIZE_OPTIONS = [15, 30, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 15;

/**
 * Options visible for a listing, based on API total record count.
 * Always keeps the current selection (and default 15) visible.
 */
export function resolveAvailablePageSizes(
  total: number,
  selected: number = DEFAULT_PAGE_SIZE,
): number[] {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeSelected = PAGE_SIZE_OPTIONS.includes(
    selected as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? selected
    : DEFAULT_PAGE_SIZE;

  const available = PAGE_SIZE_OPTIONS.filter(
    (size) =>
      size <= safeTotal ||
      size === safeSelected ||
      size === DEFAULT_PAGE_SIZE,
  );

  return available.length ? [...available] : [safeSelected];
}
