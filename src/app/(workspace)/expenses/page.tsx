import { redirect } from 'next/navigation';

import { TripEditor } from '@/features/trip-editor/TripEditor';
import { getHomeData } from '@/lib/trips/home-data';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string }>;
}) {
  const { trip: selectedTripId } = await searchParams;
  const { user, trip, trips } = await getHomeData(selectedTripId);
  if (!user) redirect('/login');

  return (
    <TripEditor
      key={`expenses-${trip?.id ?? 'no-trips'}`}
      user={user}
      initialTrip={trip}
      trips={trips}
      initialMode="expenses"
      tripBackHref={trip ? `/editor?trip=${encodeURIComponent(trip.id)}` : '/editor'}
    />
  );
}
