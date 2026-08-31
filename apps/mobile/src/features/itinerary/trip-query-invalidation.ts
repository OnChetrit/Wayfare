import type { QueryClient } from '@tanstack/react-query';
import { tripKeys } from '../../api/query-keys';

type TripQueryInvalidator = Pick<QueryClient, 'invalidateQueries'>;

/** Refreshes the trip detail that supplies itinerary and map route data. */
export function invalidateTripData(queryClient: TripQueryInvalidator, tripId: string | null) {
  return Promise.all([
    ...(tripId ? [queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })] : []),
    queryClient.invalidateQueries({ queryKey: tripKeys.all }),
  ]);
}
