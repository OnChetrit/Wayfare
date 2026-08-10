import { NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/route-auth';

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
