import type { SavedPlace, ScheduleItem } from '@wayfare/domain';

type ScheduleReminderSource = Pick<
  ScheduleItem,
  'date' | 'id' | 'savedPlaceId' | 'startTime' | 'title'
>;

/** Builds the personal-reminder context for an itinerary activity. */
export function reminderSourceForSchedule(
  schedule: ScheduleReminderSource,
  places: Pick<SavedPlace, 'id' | 'name'>[],
) {
  const title =
    places.find(place => place.id === schedule.savedPlaceId)?.name ?? schedule.title ?? 'Activity';

  return {
    remindAtLocal: `${schedule.date} ${schedule.startTime ?? '09:00'}`,
    sourceTitle: title,
  };
}
