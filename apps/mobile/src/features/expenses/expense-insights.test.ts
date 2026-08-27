import { describe, expect, it } from 'vitest';

import type { Expense, TripEditorTrip } from '@wayfare/domain';
import {
  activityExpenseTotals,
  categoryBreakdown,
  categoryExpenseTotals,
  expenseSourcesForTrip,
  groupedExpenseTotals,
  missingExpenseSources,
  newExpenseForm,
  perDayExpenseTotals,
  visibleExpenses,
} from './expense-insights';

const expenses: Expense[] = [
  {
    id: 'expense-flight',
    tripId: 'trip',
    title: 'Flight to Rome',
    category: 'FLIGHT',
    amount: 240,
    currency: 'EUR',
    expenseDate: '2026-10-10',
    flightId: 'flight-linked',
  },
  {
    id: 'expense-hotel',
    tripId: 'trip',
    title: 'Hotel',
    category: 'HOTEL',
    amount: 300,
    currency: 'EUR',
    expenseDate: '2026-10-10',
    stayId: 'stay-linked',
  },
  {
    id: 'expense-dinner',
    tripId: 'trip',
    title: 'Dinner',
    category: 'RESTAURANT',
    amount: 35,
    currency: 'USD',
    expenseDate: '2026-10-11',
    scheduleItemId: 'schedule-linked',
  },
  {
    id: 'expense-tickets',
    tripId: 'trip',
    title: 'Tickets',
    category: 'TICKETS',
    amount: 25,
    currency: 'EUR',
    expenseDate: '2026-10-11',
  },
];

const trip: Pick<
  TripEditorTrip,
  'defaultCurrency' | 'flights' | 'places' | 'schedule' | 'stays' | 'startDate'
> = {
  defaultCurrency: 'EUR',
  startDate: '2026-10-10',
  places: [],
  stays: [
    {
      id: 'stay-linked',
      tripId: 'trip',
      name: 'Linked hotel',
      savedPlaceId: null,
      checkInDate: '2026-10-10',
      checkOutDate: '2026-10-12',
    },
    {
      id: 'stay-missing',
      tripId: 'trip',
      name: 'Missing hotel',
      savedPlaceId: null,
      priceAmount: 180,
      priceCurrency: 'EUR',
      checkInDate: '2026-10-12',
      checkOutDate: '2026-10-14',
    },
  ],
  flights: [
    {
      id: 'flight-linked',
      tripId: 'trip',
      flightNumber: 'LY 315',
      departureDate: '2026-10-10',
      scheduledDepartureLocal: '2026-10-10T08:00:00+03:00',
      scheduledDepartureUtc: '2026-10-10T05:00:00Z',
      status: 'scheduled',
    },
    {
      id: 'flight-missing',
      tripId: 'trip',
      flightNumber: 'LY 316',
      departureDate: '2026-10-14',
      scheduledDepartureLocal: '2026-10-14T12:00:00+02:00',
      scheduledDepartureUtc: '2026-10-14T10:00:00Z',
      status: 'scheduled',
    },
  ],
  schedule: [
    {
      id: 'schedule-linked',
      savedPlaceId: null,
      date: '2026-10-11',
      startTime: '19:00',
      duration: 90,
      title: 'Linked dinner',
      category: 'RESTAURANT',
    },
    {
      id: 'schedule-missing',
      savedPlaceId: null,
      date: '2026-10-12',
      startTime: '10:00',
      duration: 60,
      title: 'Museum tickets',
      category: 'ATTRACTION',
      amount: 18,
      currency: 'EUR',
    },
  ],
};

describe('expense insights', () => {
  it('groups totals by currency, date, and summary category without mixing currencies', () => {
    expect(groupedExpenseTotals(expenses)).toEqual([
      { currency: 'EUR', amount: 565 },
      { currency: 'USD', amount: 35 },
    ]);
    expect(perDayExpenseTotals(expenses)).toEqual([
      { date: '2026-10-10', totals: [{ currency: 'EUR', amount: 540 }] },
      {
        date: '2026-10-11',
        totals: [
          { currency: 'EUR', amount: 25 },
          { currency: 'USD', amount: 35 },
        ],
      },
    ]);
    expect(categoryExpenseTotals(expenses, 'FLIGHT')).toEqual([{ currency: 'EUR', amount: 240 }]);
    expect(categoryExpenseTotals(expenses, 'HOTEL')).toEqual([{ currency: 'EUR', amount: 300 }]);
    expect(activityExpenseTotals(expenses)).toEqual([
      { currency: 'EUR', amount: 25 },
      { currency: 'USD', amount: 35 },
    ]);
  });

  it('filters the list and calculates a currency-scoped category breakdown', () => {
    expect(visibleExpenses(expenses, 'FLIGHT').map(expense => expense.id)).toEqual([
      'expense-flight',
    ]);
    expect(categoryBreakdown(expenses, 'EUR')).toEqual([
      { category: 'HOTEL', amount: 300, percentage: expect.closeTo(53.097345, 5) },
      { category: 'FLIGHT', amount: 240, percentage: expect.closeTo(42.477876, 5) },
      { category: 'TICKETS', amount: 25, percentage: expect.closeTo(4.424779, 5) },
    ]);
  });

  it('finds unexpensed itinerary sources and prepares a linked hotel expense', () => {
    const sources = expenseSourcesForTrip(trip);
    expect(
      missingExpenseSources(expenses, sources).map(source => `${source.kind}:${source.id}`),
    ).toEqual(['stay:stay-missing', 'schedule:schedule-missing', 'flight:flight-missing']);
    const hotel = sources.find(source => source.id === 'stay-missing');
    expect(newExpenseForm(trip, hotel)).toMatchObject({
      title: 'Missing hotel',
      category: 'HOTEL',
      amount: '180',
      currency: 'EUR',
      expenseDate: '2026-10-12',
      sourceKind: 'stay',
      sourceId: 'stay-missing',
    });
  });
});
