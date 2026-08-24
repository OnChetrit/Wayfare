import { describe, expect, it } from 'vitest';
import {
  currencyTotals,
  makeTripDays,
  sortQueueOperations,
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
});
