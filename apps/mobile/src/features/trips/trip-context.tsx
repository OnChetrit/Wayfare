import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { getTrips } from '@/api/trips';
import { tripKeys } from '@/api/query-keys';
import { isSessionInvalidError } from '@/api/error';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/lib/supabase';

import { lastTripIdFromMetadata, selectTripId } from './trip-selection';

type TripContextValue = {
  isLoadingTrips: boolean;
  isRefreshingTrips: boolean;
  selectedTripId: string | null;
  selectTrip: (tripId: string) => Promise<void>;
  selectedTrip: Awaited<ReturnType<typeof getTrips>>[number] | null;
  trips: Awaited<ReturnType<typeof getTrips>>;
  tripsError: Error | null;
  refreshTrips: () => Promise<unknown>;
};

const TripContext = React.createContext<TripContextValue | undefined>(undefined);
const noTrips: Awaited<ReturnType<typeof getTrips>> = [];

export function TripProvider({ children }: React.PropsWithChildren) {
  const { isReady, session, signOut } = useAuth();
  const [requestedTrip, setRequestedTrip] = React.useState<{
    tripId: string;
    userId: string;
  } | null>(null);
  const userId = session?.user.id ?? null;
  const tripsQuery = useQuery({
    queryKey: tripKeys.all,
    queryFn: async ({ signal }) => {
      try {
        return await getTrips({ signal });
      } catch (error) {
        if (isSessionInvalidError(error)) await signOut();
        throw error;
      }
    },
    enabled: isReady && Boolean(session),
  });

  const trips = tripsQuery.data ?? noTrips;
  const lastTripId = lastTripIdFromMetadata(session?.user.user_metadata);
  const requestedTripId = requestedTrip?.userId === userId ? requestedTrip.tripId : null;
  const selectedTripId = session ? selectTripId({ lastTripId, requestedTripId, trips }) : null;

  const selectTrip = React.useCallback(
    async (tripId: string) => {
      if (!session || !trips.some(trip => trip.id === tripId) || selectedTripId === tripId) return;

      const { error } = await supabase.auth.updateUser({ data: { lastTripId: tripId } });
      if (error) throw error;
      setRequestedTrip({ tripId, userId: session.user.id });
    },
    [selectedTripId, session, trips],
  );
  const selectedTrip = React.useMemo(
    () => trips.find(trip => trip.id === selectedTripId) ?? null,
    [selectedTripId, trips],
  );
  const value = React.useMemo(
    () => ({
      isLoadingTrips: tripsQuery.isLoading,
      isRefreshingTrips: tripsQuery.isRefetching,
      selectedTripId,
      selectTrip,
      selectedTrip,
      trips,
      tripsError: tripsQuery.error ?? null,
      refreshTrips: tripsQuery.refetch,
    }),
    [
      selectedTrip,
      selectedTripId,
      selectTrip,
      trips,
      tripsQuery.error,
      tripsQuery.isLoading,
      tripsQuery.isRefetching,
      tripsQuery.refetch,
    ],
  );
  return <TripContext value={value}>{children}</TripContext>;
}

export function useTrips() {
  const context = React.use(TripContext);
  if (!context) throw new Error('useTrips must be used inside TripProvider.');
  return context;
}
