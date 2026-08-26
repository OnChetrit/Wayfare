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
