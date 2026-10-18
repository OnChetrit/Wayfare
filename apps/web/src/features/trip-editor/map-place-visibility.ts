import type { SavedPlace } from './types';

type MapPlaceVisibility = {
  savedPlaces: SavedPlace[];
  dayPlanPlaces: SavedPlace[];
  selectedDate: string;
  showSavedPlaces: boolean;
  showDayPlan: boolean;
  showingLocationPlaces: boolean;
};

export function visibleBaseMapPlaces({
  savedPlaces,
  dayPlanPlaces,
  selectedDate,
  showSavedPlaces,
  showDayPlan,
  showingLocationPlaces,
}: MapPlaceVisibility): SavedPlace[] {
  const dayPlanIds = new Set(dayPlanPlaces.map(place => place.id));
  return [
    ...(showSavedPlaces
      ? savedPlaces.filter(
          place => showingLocationPlaces || !selectedDate || !dayPlanIds.has(place.id),
        )
      : []),
    ...(showDayPlan && selectedDate && !showingLocationPlaces ? dayPlanPlaces : []),
  ].filter((place, index, all) => all.findIndex(candidate => candidate.id === place.id) === index);
}
