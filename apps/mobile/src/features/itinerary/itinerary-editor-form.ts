import type { PlaceCategory, Stay } from '@wayfare/domain';

import type { ScheduleInput, StayInput } from '@/api/trips';

export type ScheduleFormValues = {
  amount: string;
  category: PlaceCategory;
  currency: string;
  date: string;
  duration: string;
  note: string;
  savedPlaceId: string;
  startTime: string | null;
  title: string;
};

export type StayFormValues = {
  address: string;
  cancellationTime: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationNumber: string;
  locationLabel: string;
  name: string;
  notes: string;
  priceAmount: string;
  priceCurrency: string;
  savedPlaceId: string;
  secretCode: string;
};

type FormResult<T> = { data: T } | { error: string };

function optionalText(value: string) {
  return value.trim() || null;
}

export function scheduleInputFromForm(form: ScheduleFormValues): FormResult<ScheduleInput> {
  const duration = Number(form.duration);
  if (!Number.isInteger(duration) || duration < 15 || duration > 1440) {
    return { error: 'Duration must be between 15 minutes and 24 hours.' };
  }
  if (!form.savedPlaceId && !form.title.trim()) {
    return { error: 'Choose a saved place or enter an activity title.' };
  }

  const amount = form.amount.trim() ? Number(form.amount) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return { error: 'Amount must be zero or greater.' };
  }

  return {
    data: {
      date: form.date,
      startTime: form.startTime || null,
      duration,
      savedPlaceId: form.savedPlaceId || null,
      title: form.title.trim() || undefined,
      category: form.category,
      note: form.note.trim() || undefined,
      amount,
      ...(amount === null ? {} : { currency: form.currency }),
    },
  };
}

export function stayInputFromForm(form: StayFormValues): FormResult<StayInput> {
  if (!form.name.trim()) return { error: 'Enter the stay name.' };
  if (form.checkInDate >= form.checkOutDate) {
    return { error: 'Check-out must be after check-in.' };
  }

  const priceAmount = form.priceAmount.trim() ? Number(form.priceAmount) : null;
  if (priceAmount !== null && (!Number.isFinite(priceAmount) || priceAmount < 0)) {
    return { error: 'Enter a valid price.' };
  }

  return {
    data: {
      name: form.name.trim(),
      savedPlaceId: form.savedPlaceId || null,
      address: optionalText(form.address),
      locationLabel: optionalText(form.locationLabel),
      priceAmount,
      ...(priceAmount === null ? {} : { priceCurrency: form.priceCurrency }),
      cancellationTime: optionalText(form.cancellationTime),
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      confirmationNumber: optionalText(form.confirmationNumber),
      secretCode: optionalText(form.secretCode),
      notes: optionalText(form.notes),
    },
  };
}

export function linkHotelToStayForm(
  form: StayFormValues,
  hotel: Pick<Stay, 'id' | 'name'> & { address?: string },
  destinationLabel?: string | null,
): StayFormValues {
  return {
    ...form,
    savedPlaceId: hotel.id,
    name: hotel.name,
    address: hotel.address ?? form.address,
    locationLabel: form.locationLabel || destinationLabel || '',
  };
}
