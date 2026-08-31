import { describe, expect, it } from 'vitest';
import {
  currencyTotals,
  dayRouteSavedPlaceIds,
  makeTripDays,
  orderScheduleItemsForDay,
  sortQueueOperations,
  tripEditorTripResponseSchema,
  tripInputSchema,
  type Expense,
} from '../src';

describe('shared domain contracts', () => {
  it('validates a trip date range', () => {
    expect(
      tripInputSchema.safeParse({
        name: 'Rome',
        startDate: '2026-10-12',
        endDate: '2026-10-10',
      }).success,
    ).toBe(false);
  });

  it('creates inclusive trip dates', () => {
    expect(makeTripDays('2026-10-10', '2026-10-12')).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
  });

  it('keeps totals separate by currency', () => {
    const expenses: Expense[] = [
      {
        id: '1',
        tripId: 'trip',
        title: 'Coffee',
        category: 'RESTAURANT',
        amount: 4,
        currency: 'EUR',
        expenseDate: '2026-10-10',
      },
      {
        id: '2',
        tripId: 'trip',
        title: 'Taxi',
        category: 'TRANSPORT',
        amount: 12,
        currency: 'USD',
        expenseDate: '2026-10-11',
      },
      {
        id: '3',
        tripId: 'trip',
        title: 'Dinner',
        category: 'RESTAURANT',
        amount: 30,
        currency: 'EUR',
        expenseDate: '2026-10-12',
      },
    ];
    expect(currencyTotals(expenses)).toEqual({ EUR: 34, USD: 12 });
  });

  it('replays offline work in original sequence', () => {
    expect(
      sortQueueOperations([
        {
          id: 'later',
          sequence: 2,
          table: 'saved_places',
          kind: 'update',
          payload: {},
          createdAt: '2026-10-10T12:00:00Z',
        },
        {
          id: 'first',
          sequence: 1,
          table: 'saved_places',
          kind: 'insert',
          payload: {},
          createdAt: '2026-10-10T12:01:00Z',
        },
      ]).map(operation => operation.id),
    ).toEqual(['first', 'later']);
  });

  it('orders itinerary stops chronologically and keeps manual ties stable', () => {
    expect(
      orderScheduleItemsForDay(
        [
          {
            id: 'late',
            savedPlaceId: 'late-place',
            date: '2026-10-11',
            startTime: '15:00',
            duration: 60,
          },
          {
            id: 'same-time-second',
            savedPlaceId: 'second-place',
            date: '2026-10-11',
            startTime: '10:00',
            duration: 60,
            sortOrder: 2,
          },
          {
            id: 'same-time-first',
            savedPlaceId: 'first-place',
            date: '2026-10-11',
            startTime: '10:00',
            duration: 60,
            sortOrder: 1,
          },
          {
            id: 'another-day',
            savedPlaceId: 'other-place',
            date: '2026-10-12',
            startTime: '09:00',
            duration: 60,
          },
        ],
        '2026-10-11',
      ).map(item => item.id),
    ).toEqual(['same-time-first', 'same-time-second', 'late']);
  });

  it('routes a day from the waking hotel through stops to the overnight hotel', () => {
    expect(
      dayRouteSavedPlaceIds(
        [
          {
            id: 'museum',
            savedPlaceId: 'museum-place',
            date: '2026-10-11',
            startTime: '11:00',
            duration: 90,
          },
          {
            id: 'coffee',
            savedPlaceId: 'coffee-place',
            date: '2026-10-11',
            startTime: '09:00',
            duration: 30,
          },
          {
            id: 'unmapped-activity',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: '13:00',
            duration: 60,
          },
        ],
        [
          {
            id: 'hotel',
            tripId: 'trip',
            name: 'Hotel',
            savedPlaceId: 'hotel-place',
            checkInDate: '2026-10-10',
            checkOutDate: '2026-10-13',
          },
        ],
        '2026-10-11',
      ),
    ).toEqual(['hotel-place', 'coffee-place', 'museum-place', 'hotel-place']);
  });

  it('validates the camel-case trip editor API contract', () => {
    const id = '018f7f0e-7c54-7b24-a9d2-4e3683c98f41';
    expect(
      tripEditorTripResponseSchema.parse({
        trip: {
          id,
          name: 'Rome',
          startDate: '2026-10-10',
          endDate: '2026-10-12',
          destinationLabel: 'Rome, Italy',
          defaultTimeZone: 'Europe/Rome',
          defaultCurrency: 'EUR',
          days: [],
          places: [],
          schedule: [],
          locationSegments: [],
          stays: [],
          flights: [],
          expenses: [],
        },
      }).trip.id,
    ).toBe(id);
  });
});
