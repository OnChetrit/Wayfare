export function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...options,
  }).format(date);
}

export function formatDateRange(startDate: string, endDate: string) {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function messageFromError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  return error instanceof Error && error.message ? error.message : fallback;
}
