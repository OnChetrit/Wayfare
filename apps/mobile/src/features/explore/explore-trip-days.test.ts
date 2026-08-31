import { describe, expect, it } from 'vitest';

import { tripDaysForExplore } from './explore-trip-days';

describe('tripDaysForExplore', () => {
  it('keeps persisted trip days unchanged', () => {
    const persistedDay = {
      date: '2026-08-30',
      id: 'day-id',
      label: 'Sunday',
      shortDate: 'Aug 30',
      weekday: 'SUN',
    };

    expect(
      tripDaysForExplore({
        days: [persistedDay],
        endDate: '2026-09-01',
        startDate: '2026-08-30',
      }),
    ).toEqual([persistedDay]);
  });

  it('derives an inclusive calendar from a trip date range with no stored days', () => {
    expect(
      tripDaysForExplore({
        days: [],
        endDate: '2026-09-01',
        startDate: '2026-08-30',
      }).map(day => ({ date: day.date, id: day.id, shortDate: day.shortDate })),
    ).toEqual([
      { date: '2026-08-30', id: 'derived-2026-08-30', shortDate: 'Aug 30' },
      { date: '2026-08-31', id: 'derived-2026-08-31', shortDate: 'Aug 31' },
      { date: '2026-09-01', id: 'derived-2026-09-01', shortDate: 'Sep 1' },
    ]);
  });

  it('does not invent dates for an invalid range', () => {
    expect(
      tripDaysForExplore({ days: [], endDate: '2026-08-30', startDate: '2026-09-01' }),
    ).toEqual([]);
  });
});
