import { describe, expect, it } from 'vitest';

import {
  isValidLocationRange,
  nextScheduleStartTime,
  orderedLocationBoundaries,
  validBoundaryDates,
} from './visual-itinerary';

describe('visual itinerary helpers', () => {
  it('places a newly added saved place after the day’s final activity', () => {
    expect(
      nextScheduleStartTime(
        [
          {
            id: 'schedule-1',
            savedPlaceId: null,
            date: '2026-09-02',
            startTime: '10:30',
            duration: 95,
          },
        ],
        '2026-09-02',
      ),
    ).toBe('12:05');
  });

  it('bases a suggested time on the latest timed activity, not an any-time card', () => {
    expect(
      nextScheduleStartTime(
        [
          {
            id: 'timed',
            savedPlaceId: null,
            date: '2026-09-02',
            startTime: '10:30',
            duration: 95,
          },
          {
            id: 'any-time',
            savedPlaceId: null,
            date: '2026-09-02',
            startTime: null,
            duration: 60,
            sortOrder: 1,
          },
        ],
        '2026-09-02',
      ),
    ).toBe('12:05');
  });

  it('finds only touching location boundaries and their safe dates', () => {
    const segments = [
      {
        id: 'left',
        tripId: 'trip',
        locationName: 'Rome',
        startDate: '2026-09-01',
        endDate: '2026-09-04',
      },
      {
        id: 'right',
        tripId: 'trip',
        locationName: 'Florence',
        startDate: '2026-09-04',
        endDate: '2026-09-08',
      },
      {
        id: 'gap',
        tripId: 'trip',
        locationName: 'Milan',
        startDate: '2026-09-09',
        endDate: '2026-09-10',
      },
    ];
    const [boundary] = orderedLocationBoundaries(segments);

    expect(boundary?.date).toBe('2026-09-04');
    expect(
      validBoundaryDates(
        [
          { id: '1', date: '2026-09-02', label: 'Day 2', weekday: 'Tue', shortDate: 'Sep 2' },
          { id: '2', date: '2026-09-04', label: 'Day 4', weekday: 'Thu', shortDate: 'Sep 4' },
          { id: '3', date: '2026-09-07', label: 'Day 7', weekday: 'Sun', shortDate: 'Sep 7' },
        ],
        boundary!.left,
        boundary!.right,
      ).map(day => day.date),
    ).toEqual(['2026-09-02', '2026-09-04', '2026-09-07']);
  });

  it('requires a location range to end after it starts', () => {
    expect(isValidLocationRange('2026-09-03', '2026-09-03')).toBe(false);
    expect(isValidLocationRange('2026-09-03', '2026-09-04')).toBe(true);
  });
});
