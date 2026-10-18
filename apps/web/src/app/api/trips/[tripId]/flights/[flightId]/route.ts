import { NextResponse } from 'next/server';
import { getTripEditorContext } from '@/lib/trips/flight-auth';
import {
  flightCandidateSchema,
  flightCandidateToDatabase,
  flightSelect,
} from '@/lib/trips/flights';
import { requireRouteUser } from '@/lib/supabase/route-auth';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; flightId: string }> },
) {
  const { tripId, flightId } = await context.params;
  const result = flightCandidateSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const editor = await getTripEditorContext(auth.supabase, auth.user, tripId);
  if ('error' in editor) return NextResponse.json({ error: editor.error }, { status: 403 });
  if (
    result.data.departureDate < editor.trip.start_date ||
    result.data.departureDate > editor.trip.end_date
  ) {
    return NextResponse.json(
      { error: 'The flight departure date must be inside the trip dates.' },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from('trip_flights')
    .update(flightCandidateToDatabase(result.data))
    .eq('id', flightId)
    .eq('trip_id', tripId)
    .select(flightSelect)
    .maybeSingle();
  if (error) {
    if (error.code === '23505')
      return NextResponse.json(
        { error: 'That flight is already part of this trip.' },
        { status: 409 },
      );
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
  return NextResponse.json({ flight: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tripId: string; flightId: string }> },
) {
  const { tripId, flightId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from('trip_flights')
    .delete()
    .eq('id', flightId)
    .eq('trip_id', tripId)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
  return NextResponse.json({ deleted: data.id });
}
