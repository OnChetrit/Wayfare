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
});
