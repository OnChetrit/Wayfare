import { NextResponse } from 'next/server';

import { requireRouteUser } from '@/lib/supabase/route-auth';
import { requireTripOwner, tripMembersForTrip } from '@/lib/trips/members';

export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const access = await requireTripOwner(auth.supabase, tripId);
  if (!access)
    return NextResponse.json(
      { error: 'Only the trip owner can view the member directory.' },
      { status: 403 },
    );

  try {
    return NextResponse.json({ members: await tripMembersForTrip(auth.supabase, tripId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load trip members.' },
      { status: 400 },
    );
  }
}
