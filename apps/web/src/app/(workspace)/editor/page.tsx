import { redirect } from 'next/navigation';

import { TripEditor } from '@/features/trip-editor/TripEditor';
import { getHomeData } from '@/lib/trips/home-data';

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{
    trip?: string;
    new?: string;
    day?: string;
    location?: string;
    activity?: string;
  }>;
}) {
  // await new Promise(() => {});
  const { trip: selectedTripId, new: newTrip, day, location, activity } = await searchParams;
  const { user, trip, trips } = await getHomeData(selectedTripId);
  if (!user) redirect('/login');

  return (
    <TripEditor
      key={newTrip === '1' ? 'new-trip' : (trip?.id ?? 'no-trips')}
      user={user}
      initialTrip={newTrip === '1' ? null : trip}
      initialScreenQuery={{ day, location, activity }}
      trips={trips}
      tripBackHref={trip ? `/editor?trip=${encodeURIComponent(trip.id)}` : '/editor'}
    />
  );
}
