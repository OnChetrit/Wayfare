import type { QueryClient } from '@tanstack/react-query';

import { tripKeys } from '../../api/query-keys';

type TripQueryInvalidator = Pick<QueryClient, 'invalidateQueries'>;

/** Refreshes summaries, access hints, invitations, and the owner-only member directory. */
export function invalidateTripSharingData(queryClient: TripQueryInvalidator, tripId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: tripKeys.all }),
    queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
    queryClient.invalidateQueries({ queryKey: tripKeys.invitations(tripId) }),
    queryClient.invalidateQueries({ queryKey: tripKeys.members(tripId) }),
  ]);
}
