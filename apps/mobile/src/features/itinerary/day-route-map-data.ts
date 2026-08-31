import { dayRouteSavedPlaceIds, type SavedPlace, type ScheduleItem } from '@wayfare/domain';

/** Resolves the shared ordered stop IDs into the native map's saved-place markers. */
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
