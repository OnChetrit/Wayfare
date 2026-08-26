import type { SavedPlace } from '@wayfare/domain';
import { describe, expect, it } from 'vitest';

import { filterSavedPlaces } from './saved-places-filter';

const places: SavedPlace[] = [
  {
    id: 'cafe',
    name: 'Morning Coffee',
    subtitle: 'Old Town',
    category: 'CAFE',
    emoji: '☕',
    color: '#a87552',
    lat: 0,
    lng: 0,
    isFavorite: true,
  },
  {
    id: 'museum',
    name: 'City Museum',
    subtitle: 'River district',
    category: 'ATTRACTION',
    emoji: '✧',
    color: '#5d9bd2',
    lat: 0,
    lng: 0,
  },
];

describe('filterSavedPlaces', () => {
  it('combines category and text filters', () => {
    expect(filterSavedPlaces(places, 'CAFE', 'town').map(place => place.id)).toEqual(['cafe']);
  });

  it('returns only favorites when requested', () => {
    expect(filterSavedPlaces(places, 'FAVORITES', '').map(place => place.id)).toEqual(['cafe']);
  });
});
