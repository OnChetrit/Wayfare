export function preferredCurrency(userMetadata: unknown, fallback: string) {
  if (!userMetadata || typeof userMetadata !== 'object') return fallback;

  const preferences = (userMetadata as { preferences?: unknown }).preferences;
  if (!preferences || typeof preferences !== 'object') return fallback;

  const currency = (preferences as { currency?: unknown }).currency;
  if (typeof currency !== 'string') return fallback;

  const normalized = currency.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}
