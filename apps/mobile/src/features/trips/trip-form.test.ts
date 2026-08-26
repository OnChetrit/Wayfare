import { describe, expect, it } from 'vitest';

import { newTripFormDefaults, validateTripForm } from './trip-form';

describe('trip form validation', () => {
  it('normalizes a complete trip form for the API', () => {
    expect(
      validateTripForm(
        {
          name: '  Autumn in Rome  ',
          destinationLabel: '  Rome, Italy ',
          startDate: '2026-10-10',
          endDate: '2026-10-12',
          defaultCurrency: 'eur',
        },
        'Europe/Rome',
      ),
    ).toEqual({
      data: {
        name: 'Autumn in Rome',
        destinationLabel: 'Rome, Italy',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        defaultTimeZone: 'Europe/Rome',
        defaultCurrency: 'EUR',
      },
    });
  });

  it('rejects an invalid date range', () => {
    const result = validateTripForm(
      {
        name: 'Rome',
        destinationLabel: '',
        startDate: '2026-10-12',
        endDate: '2026-10-10',
        defaultCurrency: 'EUR',
      },
      'UTC',
    );
    expect(result).toMatchObject({ error: 'End date must be on or after start date' });
  });

  it('uses a six-day default range', () => {
    expect(newTripFormDefaults('EUR', new Date(2026, 6, 10))).toMatchObject({
      startDate: '2026-07-10',
      endDate: '2026-07-16',
      defaultCurrency: 'EUR',
    });
  });
});
