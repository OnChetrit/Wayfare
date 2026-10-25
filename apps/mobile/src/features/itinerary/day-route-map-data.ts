import {
  dayGroundRoutePlaces,
  type SavedPlace,
  type ScheduleItem,
  type Stay,
} from '@wayfare/domain';

/** Resolves the shared ordered stop IDs into the native map's saved-place markers. */
export function groundRoutePlacesForDay(
  schedule: readonly ScheduleItem[],
  places: readonly SavedPlace[],
  date: string,
  stays: readonly Stay[] = [],
) {
  return dayGroundRoutePlaces(date, schedule, places, stays);
}
