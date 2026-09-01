import { describe, expect, it } from 'vitest';
import {
  currencyTotals,
  dayRouteSavedPlaceIds,
  makeTripDays,
  orderScheduleItemsForDay,
  scheduleItemSchema,
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

  it('orders timed itinerary stops chronologically and keeps manual ties stable', () => {
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

  it('keeps untimed activities between their manually ordered timed neighbours', () => {
    expect(
      orderScheduleItemsForDay(
        [
          {
            id: 'hotel',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: null,
            duration: 60,
            sortOrder: 0,
          },
          {
            id: 'other-location',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: null,
            duration: 60,
            sortOrder: 1,
          },
          {
            id: 'reservation',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: '12:00',
            duration: 60,
            sortOrder: 2,
          },
          {
            id: 'another-location',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: null,
            duration: 60,
            sortOrder: 3,
          },
          {
            id: 'evening-restaurant',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: '19:00',
            duration: 60,
            sortOrder: 4,
          },
        ],
        '2026-10-11',
      ).map(item => item.id),
    ).toEqual(['hotel', 'other-location', 'reservation', 'another-location', 'evening-restaurant']);
  });

  it('orders legacy items with missing manual order by ID without mutating input', () => {
    const items = [
      {
        id: 'z-last',
        savedPlaceId: null,
        date: '2026-10-11',
        startTime: '10:00',
        duration: 60,
      },
      {
        id: 'a-first',
        savedPlaceId: null,
        date: '2026-10-11',
        startTime: '10:00',
        duration: 60,
      },
      {
        id: 'explicit-order',
        savedPlaceId: null,
        date: '2026-10-11',
        startTime: '10:00',
        duration: 60,
        sortOrder: 4,
      },
    ];

    expect(orderScheduleItemsForDay(items, '2026-10-11').map(item => item.id)).toEqual([
      'explicit-order',
      'a-first',
      'z-last',
    ]);
    expect(items.map(item => item.id)).toEqual(['z-last', 'a-first', 'explicit-order']);
  });

  it('uses IDs as the final deterministic tie-breaker in every group', () => {
    expect(
      orderScheduleItemsForDay(
        [
          {
            id: 'untimed-b',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: null,
            duration: 60,
            sortOrder: 2,
          },
          {
            id: 'untimed-a',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: null,
            duration: 60,
            sortOrder: 2,
          },
          {
            id: 'timed-b',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: '10:00',
            duration: 60,
            sortOrder: 2,
          },
          {
            id: 'timed-a',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: '10:00',
            duration: 60,
            sortOrder: 2,
          },
        ],
        '2026-10-11',
      ).map(item => item.id),
    ).toEqual(['timed-a', 'timed-b', 'untimed-a', 'untimed-b']);
  });

  it('routes only the ordered, mappable scheduled stops', () => {
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
        '2026-10-11',
      ),
    ).toEqual(['coffee-place', 'museum-place']);
  });

  it('keeps untimed saved places in their manual route position', () => {
    expect(
      dayRouteSavedPlaceIds(
        [
          {
            id: 'untimed-second',
            savedPlaceId: 'gallery-place',
            date: '2026-10-11',
            startTime: null,
            duration: 60,
            sortOrder: 2,
          },
          {
            id: 'timed',
            savedPlaceId: 'coffee-place',
            date: '2026-10-11',
            startTime: '09:00',
            duration: 30,
            sortOrder: 9,
          },
          {
            id: 'untimed-first',
            savedPlaceId: 'market-place',
            date: '2026-10-11',
            startTime: null,
            duration: 60,
            sortOrder: 1,
          },
          {
            id: 'unmappable',
            savedPlaceId: null,
            date: '2026-10-11',
            startTime: null,
            duration: 60,
            sortOrder: 0,
          },
        ],
        '2026-10-11',
      ),
    ).toEqual(['market-place', 'gallery-place', 'coffee-place']);
  });

  it('accepts null as the only untimed schedule-item representation', () => {
    expect(
      scheduleItemSchema.parse({
        id: '018f7f0e-7c54-7b24-a9d2-4e3683c98f41',
        savedPlaceId: null,
        date: '2026-10-11',
        startTime: null,
        duration: 60,
        sortOrder: 0,
      }).startTime,
    ).toBeNull();
    expect(
      scheduleItemSchema.safeParse({
        id: '018f7f0e-7c54-7b24-a9d2-4e3683c98f41',
        savedPlaceId: null,
        date: '2026-10-11',
        startTime: '',
        duration: 60,
      }).success,
    ).toBe(false);
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
