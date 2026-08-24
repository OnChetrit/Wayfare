import { redirect } from 'next/navigation';

import { TripEditor } from '@/features/trip-editor/TripEditor';
import { getHomeData } from '@/lib/trips/home-data';

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string; new?: string }>;
}) {
  // await new Promise(() => {});
  const { trip: selectedTripId, new: newTrip } = await searchParams;
  const { user, trip, trips } = await getHomeData(selectedTripId);
  if (!user) redirect('/login');

  return (
    <TripEditor
      key={newTrip === '1' ? 'new-trip' : (trip?.id ?? 'no-trips')}
      user={user}
      initialTrip={newTrip === '1' ? null : trip}
      trips={trips}
      tripBackHref={trip ? `/editor?trip=${encodeURIComponent(trip.id)}` : '/editor'}
    />
  );
}
