import { dayRouteSavedPlaceIds } from '@wayfare/domain';
import type { SavedPlace, ScheduleItem } from './types';

/** Resolves the shared ordered stop IDs into the web map's saved-place markers. */
export function groundRoutePlacesForDay(
  schedule: readonly ScheduleItem[],
  places: readonly SavedPlace[],
  date: string,
) {
  const placesById = new Map(places.map(place => [place.id, place]));
  return dayRouteSavedPlaceIds(schedule, date).flatMap(placeId => {
    const place = placesById.get(placeId);
    return place ? [place] : [];
  });
}
