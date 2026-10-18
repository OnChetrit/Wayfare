import { NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { expenseSelect } from '@/lib/trips/expenses';
import { getTripEditorContext } from '@/lib/trips/flight-auth';
import {
  flightCandidateSchema,
  flightCandidateToDatabase,
  flightSelect,
} from '@/lib/trips/flights';

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = flightCandidateSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const contextResult = await getTripEditorContext(auth.supabase, auth.user, tripId);
  if ('error' in contextResult)
    return NextResponse.json({ error: contextResult.error }, { status: 403 });
  if (
    result.data.departureDate < contextResult.trip.start_date ||
    result.data.departureDate > contextResult.trip.end_date
  ) {
    return NextResponse.json(
      { error: 'The flight departure date must be inside the trip dates.' },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from('trip_flights')
    .insert({
      trip_id: tripId,
      created_by: auth.user.id,
      ...flightCandidateToDatabase(result.data),
    })
    .select(flightSelect)
    .single();
  if (error) {
    if (error.code === '23505')
      return NextResponse.json(
        { error: 'That flight is already part of this trip.' },
        { status: 409 },
      );
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: expense } = await auth.supabase
    .from('trip_expenses')
    .select(expenseSelect)
    .eq('flight_id', data.id)
    .maybeSingle();
  return NextResponse.json({ flight: data, expense }, { status: 201 });
}
