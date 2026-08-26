import type { PlaceCategory, SavedPlace } from '@wayfare/domain';

export type SavedPlacesFilter = 'ALL' | 'FAVORITES' | PlaceCategory;

export const savedPlacesFilterOptions: SavedPlacesFilter[] = [
  'ALL',
  'FAVORITES',
  'HOTEL',
  'RESTAURANT',
  'CAFE',
  'BAR',
  'ATTRACTION',
  'SHOPPING',
  'TRANSPORT',
  'CUSTOM',
];

export function filterSavedPlaces(places: SavedPlace[], filter: SavedPlacesFilter, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return places.filter(place => {
    const matchesCategory = filter === 'ALL' || filter === 'FAVORITES' || place.category === filter;
    const matchesFavorite = filter !== 'FAVORITES' || place.isFavorite === true;
    const matchesQuery =
      !normalizedQuery ||
      `${place.name} ${place.subtitle}`.toLocaleLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesFavorite && matchesQuery;
  });
}

export function filterSavedPlacesForLocation(places: SavedPlace[], locationSegmentId?: string) {
  if (!locationSegmentId) return places;
  return places.filter(place => place.locationSegmentIds?.includes(locationSegmentId));
}
