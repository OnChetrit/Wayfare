import type { TripDay } from '@wayfare/domain';

/** Compare date-only trip days with the current calendar date in the trip's zone. */
export function closestTripDay(days: TripDay[], timeZone: string, now = new Date()) {
  if (!days.length) return null;
  let localDate: string;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    localDate = `${value('year')}-${value('month')}-${value('day')}`;
  } catch {
    localDate = now.toISOString().slice(0, 10);
  }
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return ordered.find(day => day.date >= localDate) ?? ordered[ordered.length - 1];
}
