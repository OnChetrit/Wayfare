import type { LocationSegment, Stay } from './types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function getUtcDateValue(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(date: string, amount: number) {
  const value = new Date(getUtcDateValue(date));
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function dateDifference(startDate: string, endDate: string) {
  return Math.round((getUtcDateValue(endDate) - getUtcDateValue(startDate)) / DAY_IN_MS);
}

export function segmentLabel(segment: LocationSegment) {
  return [segment.locationName, segment.area, segment.country].filter(Boolean).join(' · ');
}

export function timelineBandSlice(
  startDate: string,
  endDate: string,
  weekStart: string,
  weekEnd: string,
) {
  const start = startDate > weekStart ? startDate : weekStart;
  const end = endDate < weekEnd ? endDate : weekEnd;
  // Bands represent nights, so their actual bounds are noon-to-noon.
  // Calculate those positions before clipping to the week's midnight bounds;
  // this preserves the first half-day when a band ends on the week start.
  const weekHalfDays = dateDifference(weekStart, weekEnd) * 2;
  const startPosition = dateDifference(weekStart, startDate) * 2 + 1;
  const endPosition = dateDifference(weekStart, endDate) * 2 + 1;
  const visibleStartPosition = Math.max(0, startPosition);
  const visibleEndPosition = Math.min(weekHalfDays, endPosition);
  if (visibleStartPosition >= visibleEndPosition) return null;

  return {
    start,
    end,
    offset: dateDifference(weekStart, start),
    nights: dateDifference(start, end),
    startColumn: visibleStartPosition + 1,
    endColumn: visibleEndPosition + 1,
  };
}

export function segmentSlice(segment: LocationSegment, weekStart: string, weekEnd: string) {
  return timelineBandSlice(segment.startDate, segment.endDate, weekStart, weekEnd);
}

export function staySlice(stay: Stay, weekStart: string, weekEnd: string) {
  return timelineBandSlice(stay.checkInDate, stay.checkOutDate, weekStart, weekEnd);
}
