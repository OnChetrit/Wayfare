import { describe, expect, it } from 'vitest';
import type { SavedPlace, ScheduleItem } from '@wayfare/domain';
import { groundRoutePlacesForDay } from './day-route-map-data';

const places: SavedPlace[] = [
  {
    id: 'coffee',
    name: 'Coffee',
    subtitle: 'Breakfast',
    category: 'CAFE',
    emoji: '☕',
    color: '#a87552',
    lat: 41.9,
    lng: 12.49,
  },
  {
    id: 'museum',
    name: 'Museum',
    subtitle: 'Art',
    category: 'ATTRACTION',
    emoji: '✧',
    color: '#5d9bd2',
    lat: 41.91,
    lng: 12.5,
  },
  {
    id: 'dinner',
    name: 'Dinner',
    subtitle: 'Pasta',
    category: 'RESTAURANT',
    emoji: '✦',
    color: '#e8795d',
    lat: 41.88,
    lng: 12.48,
  },
];

describe('native ground map route', () => {
  it('uses the same ordered coordinate sequence as the web map', () => {
    const schedule: ScheduleItem[] = [
      {
        id: 'dinner',
        savedPlaceId: 'dinner',
        date: '2026-10-11',
        startTime: '19:00',
        duration: 60,
        sortOrder: 2,
      },
      {
        id: 'manual',
        savedPlaceId: null,
        date: '2026-10-11',
        startTime: '10:00',
        duration: 60,
        sortOrder: 0,
      },
      {
        id: 'museum',
        savedPlaceId: 'museum',
        date: '2026-10-11',
        startTime: '10:00',
        duration: 60,
        sortOrder: 1,
      },
      {
        id: 'coffee',
        savedPlaceId: 'coffee',
        date: '2026-10-11',
        startTime: '10:00',
        duration: 60,
        sortOrder: 0,
      },
    ];

    expect(
      groundRoutePlacesForDay(schedule, places, '2026-10-11').map(place => [
        place.id,
        place.lat,
        place.lng,
      ]),
    ).toEqual([
      ['coffee', 41.9, 12.49],
      ['museum', 41.91, 12.5],
      ['dinner', 41.88, 12.48],
    ]);
  });
});
