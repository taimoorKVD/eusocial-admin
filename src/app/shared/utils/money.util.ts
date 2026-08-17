/** Display helper: always prefer `$` even if API still returns `€`/EUR formatting. */
export function displayMoney(
  formatted?: string | null,
  amount?: number | null,
  fallback = '$0.00'
): string {
  if (formatted) {
    return String(formatted)
      .replace(/€/g, '$')
      .replace(/\bEUR\b/gi, 'USD');
  }

  if (amount != null && !Number.isNaN(Number(amount))) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(Number(amount));
  }

  return fallback;
}
