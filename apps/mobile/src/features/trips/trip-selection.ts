type TripWithId = { id: string };

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
