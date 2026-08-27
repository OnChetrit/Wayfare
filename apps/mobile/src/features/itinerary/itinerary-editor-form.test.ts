import { describe, expect, it } from 'vitest';

import {
  linkHotelToStayForm,
  scheduleInputFromForm,
  stayInputFromForm,
  type StayFormValues,
} from './itinerary-editor-form';

const stayForm: StayFormValues = {
  name: '  Hotel Artemide ',
  savedPlaceId: '',
  address: '  Via Nazionale 22 ',
  locationLabel: ' Rome ',
  priceAmount: ' 489.50 ',
  priceCurrency: 'EUR',
  cancellationTime: ' 18:00 local time ',
  checkInDate: '2026-10-10',
  checkOutDate: '2026-10-12',
  confirmationNumber: ' ABC123 ',
  secretCode: ' 9412 ',
  notes: ' Breakfast included ',
};

describe('itinerary editor form mapping', () => {
  it('persists an optional activity amount with its selected currency', () => {
    expect(
      scheduleInputFromForm({
        date: '2026-10-10',
        startTime: '09:30',
        duration: '90',
        savedPlaceId: '',
        title: ' Museum tickets ',
        category: 'ATTRACTION',
        note: ' Two adults ',
        amount: ' 42.50 ',
        currency: 'USD',
      }),
    ).toEqual({
      data: {
        date: '2026-10-10',
        startTime: '09:30',
        duration: 90,
        savedPlaceId: null,
        title: 'Museum tickets',
        category: 'ATTRACTION',
        note: 'Two adults',
        amount: 42.5,
        currency: 'USD',
      },
    });
  });

  it('clears a previous activity amount and rejects invalid values', () => {
    const emptyAmount = scheduleInputFromForm({
      date: '2026-10-10',
      startTime: '09:30',
      duration: '60',
      savedPlaceId: 'saved-place-id',
      title: '',
      category: 'CUSTOM',
      note: '',
      amount: '',
      currency: 'EUR',
    });

    expect(emptyAmount).toEqual({
      data: {
        date: '2026-10-10',
        startTime: '09:30',
        duration: 60,
        savedPlaceId: 'saved-place-id',
        title: undefined,
        category: 'CUSTOM',
        note: undefined,
        amount: null,
      },
    });
    expect(
      scheduleInputFromForm({
        date: '2026-10-10',
        startTime: '09:30',
        duration: '60',
        savedPlaceId: 'saved-place-id',
        title: '',
        category: 'CUSTOM',
        note: '',
        amount: '-4',
        currency: 'EUR',
      }),
    ).toEqual({ error: 'Amount must be zero or greater.' });
  });

  it('maps all stay detail fields and clears optional values with nulls', () => {
    expect(stayInputFromForm(stayForm)).toEqual({
      data: {
        name: 'Hotel Artemide',
        savedPlaceId: null,
        address: 'Via Nazionale 22',
        locationLabel: 'Rome',
        priceAmount: 489.5,
        priceCurrency: 'EUR',
        cancellationTime: '18:00 local time',
        checkInDate: '2026-10-10',
        checkOutDate: '2026-10-12',
        confirmationNumber: 'ABC123',
        secretCode: '9412',
        notes: 'Breakfast included',
      },
    });
    expect(
      stayInputFromForm({
        ...stayForm,
        address: '',
        cancellationTime: '',
        confirmationNumber: '',
        notes: '',
        priceAmount: '',
        secretCode: '',
      }),
    ).toMatchObject({
      data: {
        address: null,
        cancellationTime: null,
        confirmationNumber: null,
        notes: null,
        priceAmount: null,
        secretCode: null,
      },
    });
  });

  it('links a selected hotel and preserves a manually chosen city or area', () => {
    expect(
      linkHotelToStayForm(
        stayForm,
        { id: 'hotel-place-id', name: 'Hotel Artemide', address: 'Via Nazionale 22' },
        'Rome, Italy',
      ),
    ).toMatchObject({
      savedPlaceId: 'hotel-place-id',
      name: 'Hotel Artemide',
      address: 'Via Nazionale 22',
      locationLabel: ' Rome ',
    });
    expect(
      linkHotelToStayForm(
        { ...stayForm, locationLabel: '' },
        { id: 'hotel-place-id', name: 'Hotel Artemide', address: 'Via Nazionale 22' },
        'Rome, Italy',
      ),
    ).toMatchObject({ locationLabel: 'Rome, Italy' });
  });
});
