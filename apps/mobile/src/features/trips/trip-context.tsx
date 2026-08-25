import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { getTrips } from '@/api/trips';
import { tripKeys } from '@/api/query-keys';
import { isSessionInvalidError } from '@/api/error';
import { useAuth } from '@/features/auth/auth-context';

type TripContextValue = {
  isLoadingTrips: boolean;
  isRefreshingTrips: boolean;
  selectedTripId: string | null;
  selectTrip: (tripId: string) => void;
  selectedTrip: Awaited<ReturnType<typeof getTrips>>[number] | null;
  trips: Awaited<ReturnType<typeof getTrips>>;
  tripsError: Error | null;
  refreshTrips: () => Promise<unknown>;
};

const TripContext = React.createContext<TripContextValue | undefined>(undefined);
const noTrips: Awaited<ReturnType<typeof getTrips>> = [];

export function TripProvider({ children }: React.PropsWithChildren) {
  const { isReady, session, signOut } = useAuth();
  const [requestedTripId, setRequestedTripId] = React.useState<string | null>(null);
  const tripsQuery = useQuery({
    queryKey: tripKeys.all,
    queryFn: async ({ signal }) => {
      try {
        console.log('signal', signal);
        return await getTrips({ signal });
      } catch (error) {
        if (isSessionInvalidError(error)) await signOut();
        throw error;
      }
    },
    enabled: isReady && Boolean(session),
  });

  console.log('tripsQuery', tripsQuery);
  const trips = tripsQuery.data ?? noTrips;
  const selectedTripId = session
    ? ((requestedTripId && trips.some(trip => trip.id === requestedTripId)
        ? requestedTripId
        : trips[0]?.id) ?? null)
    : null;

  const selectTrip = React.useCallback(
    (tripId: string) => {
      if (trips.some(trip => trip.id === tripId)) setRequestedTripId(tripId);
    },
    [trips],
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
