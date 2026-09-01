type TripWithId = { id: string };

export function selectedTripDayDate(
  selectedDayDates: Readonly<Record<string, string>>,
  selectedTripId: string | null,
) {
  return selectedTripId ? (selectedDayDates[selectedTripId] ?? null) : null;
}

export function withSelectedTripDayDate(
  selectedDayDates: Readonly<Record<string, string>>,
  selectedTripId: string | null,
  date: string,
) {
  if (!selectedTripId || selectedDayDates[selectedTripId] === date) return selectedDayDates;
  return { ...selectedDayDates, [selectedTripId]: date };
}

export function lastTripIdFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const lastTripId = metadata?.lastTripId;
  return typeof lastTripId === 'string' ? lastTripId : null;
}

export function selectTripId<TTrip extends TripWithId>({
  requestedTripId,
  lastTripId,
  trips,
}: {
  requestedTripId: string | null;
  lastTripId: string | null;
  trips: TTrip[];
}) {
  for (const tripId of [requestedTripId, lastTripId, trips[0]?.id]) {
    if (tripId && trips.some(trip => trip.id === tripId)) return tripId;
  }

  return null;
}

export function selectedTripIdAfterDeletion<TTrip extends TripWithId>({
  deletedTripId,
  selectedTripId,
  trips,
}: {
  deletedTripId: string;
  selectedTripId: string | null;
  trips: TTrip[];
}) {
  const remainingTrips = trips.filter(trip => trip.id !== deletedTripId);
  if (!remainingTrips.length) return null;
  if (selectedTripId && selectedTripId !== deletedTripId) {
    return remainingTrips.some(trip => trip.id === selectedTripId)
      ? selectedTripId
      : remainingTrips[0]!.id;
  }
  return remainingTrips[0]!.id;
}
