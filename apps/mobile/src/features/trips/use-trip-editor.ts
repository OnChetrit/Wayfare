import { useQuery } from '@tanstack/react-query';

import { isSessionInvalidError } from '@/api/error';
import { getTripEditor } from '@/api/trips';
import { tripKeys } from '@/api/query-keys';
import { useAuth } from '@/features/auth/auth-context';
import { useTrips } from '@/features/trips/trip-context';

export function useTripEditor() {
  const { selectedTripId } = useTrips();
  const { signOut } = useAuth();
  return useQuery({
    queryKey: selectedTripId ? tripKeys.detail(selectedTripId) : ['trips', 'none'],
    queryFn: async ({ signal }) => {
      try {
        return await getTripEditor(selectedTripId!, signal);
      } catch (error) {
        if (isSessionInvalidError(error)) await signOut();
        throw error;
      }
    },
    enabled: Boolean(selectedTripId),
    // This data can also be changed from the web editor. Always reconcile it
    // when an itinerary screen mounts or the app returns to the foreground.
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}
