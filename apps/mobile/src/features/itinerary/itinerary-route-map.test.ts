import { describe, expect, it } from 'vitest';
import type { TripEditorTrip } from '@wayfare/domain';

import { itineraryRouteMapData } from './itinerary-route-map';

const trip = {
  startDate: '2026-10-10',
  endDate: '2026-10-11',
  places: [
    {
      id: 'rome',
      name: 'Rome',
      subtitle: 'Italy',
      category: 'CUSTOM',
      emoji: '1',
      color: '#111111',
      lat: 41.9028,
      lng: 12.4964,
    },
    {
      id: 'florence',
      name: 'Florence',
      subtitle: 'Italy',
      category: 'CUSTOM',
      emoji: '2',
      color: '#222222',
      lat: 43.7696,
      lng: 11.2558,
    },
  ],
  schedule: [
    {
      id: 'rome-stop',
      savedPlaceId: 'rome',
      date: '2026-10-10',
      startTime: '09:00',
      duration: 60,
    },
    {
      id: 'florence-stop',
      savedPlaceId: 'florence',
      date: '2026-10-11',
      startTime: '09:00',
      duration: 60,
    },
  ],
} as TripEditorTrip;

describe('itineraryRouteMapData', () => {
  it('shows every itinerary day in the initial overview', () => {
    const overview = itineraryRouteMapData(trip);

    expect(overview.places.map(place => place.name)).toEqual([
      'Day 1 · Stop 1 · Rome',
      'Day 2 · Stop 1 · Florence',
    ]);
    expect(overview.routes.map(route => route.id)).toEqual(['2026-10-10', '2026-10-11']);
    expect(overview.places.map(place => place.sourcePlaceId)).toEqual(['rome', 'florence']);
  });

  it('can focus the map on one selected day', () => {
    const day = itineraryRouteMapData(trip, '2026-10-11');

    expect(day.places).toHaveLength(1);
    expect(day.places[0]?.badge).toBe('1');
    expect(day.routes.map(route => route.id)).toEqual(['2026-10-11']);
  });

  it('includes a mapped overnight stay in each day route', () => {
    const withStay = {
      ...trip,
      stays: [
        {
          id: 'stay',
          tripId: 'trip',
          name: 'Rome hotel',
          savedPlaceId: 'rome',
          checkInDate: '2026-10-10',
          checkOutDate: '2026-10-12',
        },
      ],
    } as TripEditorTrip;
    const result = itineraryRouteMapData(withStay, '2026-10-11');
    expect(result.places.map(place => place.name)).toEqual([
      'Day 2 · Stop 1 · Florence',
      'Day 2 · Stay · Rome',
    ]);
    expect(result.routes[0].coordinates).toEqual([
      { latitude: 41.9028, longitude: 12.4964 },
      { latitude: 43.7696, longitude: 11.2558 },
      { latitude: 41.9028, longitude: 12.4964 },
    ]);
  });
});
