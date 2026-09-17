import { makeTripDays, type LocationSegment, type TripDay } from '@wayfare/domain';

type TripDates = {
  days: TripDay[];
  endDate: string;
  startDate: string;
};

export type ExploreDaySection = {
  days: TripDay[];
  id: string;
  locationName: string;
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

/**
 * Keeps the day picker chronological while adding a heading for each location
 * segment. A trip can have unassigned gaps, so those days remain selectable.
 */
export function sectionExploreDaysByLocation(
  days: TripDay[],
  locationSegments: LocationSegment[],
): ExploreDaySection[] {
  const orderedSegments = [...locationSegments].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );
  const sections: ExploreDaySection[] = [];

  for (const day of days) {
    const segment = orderedSegments.find(
      candidate => candidate.startDate <= day.date && day.date < candidate.endDate,
    );
    const id = segment?.id ?? 'unassigned';
    const locationName = segment?.locationName ?? 'Unassigned';
    const previous = sections.at(-1);

    if (previous?.id === id) {
      previous.days.push(day);
      continue;
    }

    sections.push({ days: [day], id, locationName });
  }

  return sections;
}
