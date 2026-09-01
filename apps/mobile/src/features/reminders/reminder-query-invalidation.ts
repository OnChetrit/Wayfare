import type { QueryClient } from '@tanstack/react-query';

import { tripKeys } from '../../api/query-keys';

type ReminderQueryInvalidator = Pick<QueryClient, 'invalidateQueries'>;

/** Personal reminder changes must not refetch shared trip, map, or itinerary data. */
export function invalidateReminderData(
  queryClient: ReminderQueryInvalidator,
  tripId: string | null,
) {
  return tripId
    ? queryClient.invalidateQueries({ queryKey: tripKeys.reminders(tripId) })
    : Promise.resolve();
}
