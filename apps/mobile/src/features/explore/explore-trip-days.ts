import { makeTripDays, type TripDay } from '@wayfare/domain';

type TripDates = {
  days: TripDay[];
  endDate: string;
  startDate: string;
};

function derivedTripDay(dateValue: string): TripDay {
  const date = new Date(`${dateValue}T12:00:00Z`);

  return {
    // This value is used only for React rendering and selection. It is never
    // sent to the API, where day IDs must be database UUIDs.
    id: `derived-${dateValue}`,
    date: dateValue,
    label: new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
      .format(date)
      .toUpperCase(),
    shortDate: new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(date),
  };
}

/**
 * Older trips can have a valid date range but no persisted trip_day records.
 * Explore only needs the calendar dates to filter the plan, so derive those
 * dates locally until the server has persisted records for the trip.
 */
export function tripDaysForExplore(trip: TripDates | undefined): TripDay[] {
  if (!trip) return [];
  if (trip.days.length) return trip.days;

  return makeTripDays(trip.startDate, trip.endDate).map(derivedTripDay);
}
