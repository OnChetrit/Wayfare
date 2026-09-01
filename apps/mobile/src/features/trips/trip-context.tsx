import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { getTrips } from '@/api/trips';
import { tripKeys } from '@/api/query-keys';
import { isSessionInvalidError } from '@/api/error';
import { useAuth } from '@/features/auth/auth-context';
import { supabase } from '@/lib/supabase';

import {
  lastTripIdFromMetadata,
  selectedTripDayDate,
  selectedTripIdAfterDeletion,
  selectTripId,
  withSelectedTripDayDate,
} from './trip-selection';

type TripContextValue = {
  isLoadingTrips: boolean;
  isRefreshingTrips: boolean;
  selectedTripDayDate: string | null;
  selectedTripId: string | null;
  selectTripDay: (date: string) => void;
  selectTrip: (tripId: string) => Promise<void>;
  selectCreatedTrip: (tripId: string) => Promise<void>;
  reselectAfterTripDeletion: (
    deletedTripId: string,
    remainingTrips: Awaited<ReturnType<typeof getTrips>>,
  ) => Promise<void>;
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
  const [selectedDayDates, setSelectedDayDates] = React.useState<Record<string, string>>({});
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
  const selectedTripDay = selectedTripDayDate(selectedDayDates, selectedTripId);

  const persistTripSelection = React.useCallback(
    async (tripId: string | null) => {
      if (!session) return;
      if (tripId === selectedTripId && tripId !== null) return;

      const { error } = await supabase.auth.updateUser({ data: { lastTripId: tripId } });
      if (error) throw error;
      setRequestedTrip(tripId ? { tripId, userId: session.user.id } : null);
    },
    [selectedTripId, session],
  );
  const selectTrip = React.useCallback(
    async (tripId: string) => {
      if (!trips.some(trip => trip.id === tripId)) return;
      await persistTripSelection(tripId);
    },
    [persistTripSelection, trips],
  );
  const selectCreatedTrip = React.useCallback(
    async (tripId: string) => {
      await persistTripSelection(tripId);
    },
    [persistTripSelection],
  );
  const selectTripDay = React.useCallback(
    (date: string) => {
      setSelectedDayDates(current => withSelectedTripDayDate(current, selectedTripId, date));
    },
    [selectedTripId],
  );
  const reselectAfterTripDeletion = React.useCallback(
    async (deletedTripId: string, remainingTrips: Awaited<ReturnType<typeof getTrips>>) => {
      const nextTripId = selectedTripIdAfterDeletion({
        deletedTripId,
        selectedTripId,
        trips: remainingTrips,
      });
      await persistTripSelection(nextTripId);
    },
    [persistTripSelection, selectedTripId],
  );
  const selectedTrip = React.useMemo(
    () => trips.find(trip => trip.id === selectedTripId) ?? null,
    [selectedTripId, trips],
  );
  const value = React.useMemo(
    () => ({
      isLoadingTrips: tripsQuery.isLoading,
      isRefreshingTrips: tripsQuery.isRefetching,
      selectedTripDayDate: selectedTripDay,
      selectedTripId,
      selectTripDay,
      selectTrip,
      selectCreatedTrip,
      reselectAfterTripDeletion,
      selectedTrip,
      trips,
      tripsError: tripsQuery.error ?? null,
      refreshTrips: tripsQuery.refetch,
    }),
    [
      selectedTrip,
      selectedTripDay,
      selectedTripId,
      selectCreatedTrip,
      selectTripDay,
      selectTrip,
      reselectAfterTripDeletion,
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
