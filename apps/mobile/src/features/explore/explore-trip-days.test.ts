import { describe, expect, it } from 'vitest';

import { sectionExploreDaysByLocation, tripDaysForExplore } from './explore-trip-days';

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

  it('groups days under their chronological location sections', () => {
    const days = [
      { date: '2026-11-04', id: 'wed', label: 'Wednesday', shortDate: 'Nov 4', weekday: 'WED' },
      { date: '2026-11-05', id: 'thu', label: 'Thursday', shortDate: 'Nov 5', weekday: 'THU' },
      { date: '2026-11-06', id: 'fri', label: 'Friday', shortDate: 'Nov 6', weekday: 'FRI' },
      { date: '2026-11-07', id: 'sat', label: 'Saturday', shortDate: 'Nov 7', weekday: 'SAT' },
      { date: '2026-11-08', id: 'sun', label: 'Sunday', shortDate: 'Nov 8', weekday: 'SUN' },
    ];

    expect(
      sectionExploreDaysByLocation(days, [
        {
          endDate: '2026-11-08',
          id: 'hakone',
          locationName: 'Hakone',
          startDate: '2026-11-07',
          tripId: 'trip-id',
        },
        {
          endDate: '2026-11-07',
          id: 'tokyo',
          locationName: 'Tokyo',
          startDate: '2026-11-04',
          tripId: 'trip-id',
        },
        {
          endDate: '2026-11-09',
          id: 'kyoto',
          locationName: 'Kyoto',
          startDate: '2026-11-08',
          tripId: 'trip-id',
        },
      ]),
    ).toEqual([
      { days: [days[0], days[1], days[2]], id: 'tokyo', locationName: 'Tokyo' },
      { days: [days[3]], id: 'hakone', locationName: 'Hakone' },
      { days: [days[4]], id: 'kyoto', locationName: 'Kyoto' },
    ]);
  });

  it('keeps unassigned days selectable', () => {
    const days = [
      { date: '2026-11-04', id: 'wed', label: 'Wednesday', shortDate: 'Nov 4', weekday: 'WED' },
      { date: '2026-11-05', id: 'thu', label: 'Thursday', shortDate: 'Nov 5', weekday: 'THU' },
    ];

    expect(
      sectionExploreDaysByLocation(days, [
        {
          endDate: '2026-11-05',
          id: 'tokyo',
          locationName: 'Tokyo',
          startDate: '2026-11-04',
          tripId: 'trip-id',
        },
      ]),
    ).toEqual([
      { days: [days[0]], id: 'tokyo', locationName: 'Tokyo' },
      { days: [days[1]], id: 'unassigned', locationName: 'Unassigned' },
    ]);
  });
});
