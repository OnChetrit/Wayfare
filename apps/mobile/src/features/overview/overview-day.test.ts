import { describe, expect, it } from 'vitest';
import type { TripDay } from '@wayfare/domain';

import { closestTripDay } from './overview-day';

const days = ['2026-10-18', '2026-10-19', '2026-10-20'].map((date, index): TripDay => ({
  id: `${index}`,
  date,
  label: `Day ${index + 1}`,
  weekday: '',
  shortDate: '',
}));

describe('closestTripDay', () => {
  it('chooses the first day before the trip, today during it, and last day afterward', () => {
    expect(closestTripDay(days, 'UTC', new Date('2026-10-17T12:00:00Z'))?.date).toBe(days[0].date);
    expect(closestTripDay(days, 'UTC', new Date('2026-10-19T12:00:00Z'))?.date).toBe(days[1].date);
    expect(closestTripDay(days, 'UTC', new Date('2026-10-22T12:00:00Z'))?.date).toBe(days[2].date);
  });

  it('uses the trip time zone at the day boundary', () => {
    const instant = new Date('2026-10-18T22:30:00Z');
    expect(closestTripDay(days, 'Asia/Jerusalem', instant)?.date).toBe(days[1].date);
    expect(closestTripDay(days, 'America/Los_Angeles', instant)?.date).toBe(days[0].date);
  });

  it('keeps empty days selectable', () => {
    expect(closestTripDay(days, 'UTC', new Date('2026-10-19T12:00:00Z'))).toEqual(days[1]);
    expect(closestTripDay([], 'UTC')).toBeNull();
  });
});
