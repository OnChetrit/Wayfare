import { tripInputSchema, type TripInput } from '@wayfare/domain';

export type TripFormValues = {
  name: string;
  destinationLabel: string;
  startDate: string;
  endDate: string;
  defaultCurrency: string;
};

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function newTripFormDefaults(currency: string, now = new Date()): TripFormValues {
  const startDate = dateValue(now);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 6);
  return {
    name: '',
    destinationLabel: '',
    startDate,
    endDate: dateValue(endDate),
    defaultCurrency: currency,
  };
}

export function tripFormFromTrip(trip: {
  name: string;
  destinationLabel: string | null;
  startDate: string;
  endDate: string;
  defaultCurrency: string;
}): TripFormValues {
  return {
    name: trip.name,
    destinationLabel: trip.destinationLabel ?? '',
    startDate: trip.startDate,
    endDate: trip.endDate,
    defaultCurrency: trip.defaultCurrency,
  };
}

export function validateTripForm(
  form: TripFormValues,
  defaultTimeZone: string,
): { data: TripInput } | { error: string } {
  const parsed = tripInputSchema.safeParse({
    name: form.name,
    destinationLabel: form.destinationLabel.trim() || undefined,
    startDate: form.startDate,
    endDate: form.endDate,
    defaultTimeZone,
    defaultCurrency: form.defaultCurrency,
  });
  if (parsed.success) return { data: parsed.data };

  return { error: parsed.error.issues[0]?.message ?? 'Check the trip details and try again.' };
}
