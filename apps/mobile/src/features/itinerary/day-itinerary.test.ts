import { describe, expect, it } from 'vitest';

import type { ScheduleItem, Stay, TripFlight } from '@wayfare/domain';

import { dayItineraryEntries } from './day-itinerary';

const flight: TripFlight = {
  id: 'flight-1',
  tripId: 'trip-1',
  flightNumber: 'LY 315',
  departureDate: '2026-10-10',
  arrivalDate: '2026-10-10',
  scheduledDepartureLocal: '2026-10-10T08:10:00+03:00',
  scheduledDepartureUtc: '2026-10-10T05:10:00Z',
  scheduledArrivalLocal: '2026-10-10T10:50:00+02:00',
  scheduledArrivalUtc: '2026-10-10T08:50:00Z',
  status: 'scheduled',
};

const stay: Stay = {
  id: 'stay-1',
  tripId: 'trip-1',
  name: 'Hotel Artemide',
  savedPlaceId: null,
  checkInDate: '2026-10-10',
  checkOutDate: '2026-10-12',
  checkInTime: '13:00',
  checkOutTime: '11:00',
};

const schedule: ScheduleItem[] = [
  {
    id: 'dinner',
    savedPlaceId: null,
    date: '2026-10-10',
    startTime: '19:00',
    duration: 90,
    sortOrder: 0,
    title: 'Dinner',
  },
  {
    id: 'museum',
    savedPlaceId: null,
    date: '2026-10-10',
    startTime: '11:30',
    duration: 90,
    sortOrder: 1,
    title: 'Museum',
  },
  {
    id: 'wander',
    savedPlaceId: null,
    date: '2026-10-10',
    startTime: null,
    duration: 60,
    sortOrder: 2,
    title: 'Wander',
  },
];

describe('day itinerary entries', () => {
  it('interleaves flights, stays, and activities using their local times', () => {
    expect(
      dayItineraryEntries(schedule, [flight], [stay], '2026-10-10').map(entry => entry.key),
    ).toEqual([
      'flight:flight-1:departure',
      'flight:flight-1:arrival',
      'schedule:museum',
      'stay:stay-1:check-in',
      'schedule:dinner',
      'schedule:wander',
    ]);
  });

  it('keeps an overnight stay visible on each day of its range', () => {
    expect(dayItineraryEntries([], [], [stay], '2026-10-11')[0]).toMatchObject({
      key: 'stay:stay-1:overnight',
      time: null,
    });
    expect(dayItineraryEntries([], [], [stay], '2026-10-12')[0]).toMatchObject({
      key: 'stay:stay-1:check-out',
      time: '11:00',
    });
  });
});
