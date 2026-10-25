import { dayGroundRoutePlaces } from '@wayfare/domain';
import type { SavedPlace, ScheduleItem, Stay } from './types';

/** Resolves the shared ordered stop IDs into the web map's saved-place markers. */
export function groundRoutePlacesForDay(
  schedule: readonly ScheduleItem[],
  places: readonly SavedPlace[],
  date: string,
  stays: readonly Stay[] = [],
) {
  return dayGroundRoutePlaces(date, schedule, places, stays);
}
