import {
  orderScheduleItemsForDay,
  type ScheduleItem,
  type Stay,
  type TripFlight,
} from '@wayfare/domain';

import { flightEventTime, flightEventsForDate, type FlightEventKind } from './flight-details';

export type StayEventKind = 'check-in' | 'check-out' | 'overnight';

export type DayItineraryEntry =
  | {
      kind: 'schedule';
      item: ScheduleItem;
      key: string;
      scheduleIndex: number;
      time: string | null;
    }
  | {
      kind: 'flight';
      event: FlightEventKind;
      flight: TripFlight;
      key: string;
      time: string | null;
    }
  | {
      kind: 'stay';
      event: StayEventKind;
      key: string;
      stay: Stay;
      time: string | null;
    };

function normalizedTime(value: string | null | undefined) {
  const match = value?.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function stayEventForDate(stay: Stay, date: string): StayEventKind | null {
  if (stay.checkInDate === date) return 'check-in';
  if (stay.checkOutDate === date) return 'check-out';
  return stay.checkInDate < date && stay.checkOutDate > date ? 'overnight' : null;
}

function entryKindOrder(entry: DayItineraryEntry) {
  if (entry.kind === 'flight') return 0;
  if (entry.kind === 'schedule') return 1;
  return 2;
}

function entryTime(entry: DayItineraryEntry) {
  // Entries without a known time remain after the day's timed plan. This avoids
  // inventing a check-in or activity time while keeping every known event ordered.
  return entry.time ?? '99:99';
}

/**
 * Combines the day's activities, flight movements, and hotel status into the
 * chronological sequence used by the mobile itinerary.
 */
export function dayItineraryEntries(
  schedule: ScheduleItem[],
  flights: TripFlight[],
  stays: Stay[],
  date: string,
) {
  const scheduledEntries = orderScheduleItemsForDay(schedule, date).map((item, scheduleIndex) => ({
    kind: 'schedule' as const,
    item,
    key: `schedule:${item.id}`,
    scheduleIndex,
    time: normalizedTime(item.startTime),
  }));
  const flightEntries = flightEventsForDate(flights, date).map(({ flight, kind }) => ({
    kind: 'flight' as const,
    event: kind,
    flight,
    key: `flight:${flight.id}:${kind}`,
    time: flightEventTime(flight, kind),
  }));
  const stayEntries = stays.flatMap(stay => {
    const event = stayEventForDate(stay, date);
    if (!event) return [];
    return [
      {
        kind: 'stay' as const,
        event,
        key: `stay:${stay.id}:${event}`,
        stay,
        time: normalizedTime(
          event === 'check-in'
            ? stay.checkInTime
            : event === 'check-out'
              ? stay.checkOutTime
              : null,
        ),
      },
    ];
  });

  return [...scheduledEntries, ...flightEntries, ...stayEntries].sort((left, right) => {
    const timeComparison = entryTime(left).localeCompare(entryTime(right));
    if (timeComparison) return timeComparison;

    if (left.kind === 'schedule' && right.kind === 'schedule') {
      return left.scheduleIndex - right.scheduleIndex;
    }

    const kindComparison = entryKindOrder(left) - entryKindOrder(right);
    if (kindComparison) return kindComparison;
    return left.key.localeCompare(right.key);
  });
}
