import type { SavedPlace } from '@wayfare/domain';

import type { MapPlace } from '@/components/trip-map';
import type { GooglePlaceSearchResult } from '@/api/trips';

type PlaceWithMapCoordinates = Pick<
  GooglePlaceSearchResult,
  'id' | 'name' | 'subtitle' | 'lat' | 'lng' | 'color'
>;

export function toMapPlace(place: PlaceWithMapCoordinates): MapPlace {
  return {
    id: place.id,
    name: place.name,
    subtitle: place.subtitle,
    lat: place.lat,
    lng: place.lng,
    color: place.color,
  };
}

export function mapPlacesForExplore(
  savedPlaces: SavedPlace[],
  selectedPlace: MapPlace | null,
): MapPlace[] {
  const places = selectedPlace
    ? [toMapPlace(selectedPlace), ...savedPlaces.map(toMapPlace)]
    : savedPlaces.map(toMapPlace);
  const uniquePlaces = new Map<string, MapPlace>();
  for (const place of places) {
    if (!uniquePlaces.has(place.id)) uniquePlaces.set(place.id, place);
  }
  return Array.from(uniquePlaces.values());
}
