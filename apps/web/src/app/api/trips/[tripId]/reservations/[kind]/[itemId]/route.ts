import { NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/route-auth';
const tables: Record<string, string> = {
  ACTIVITY: 'schedule_items',
  HOTEL: 'stays',
  FLIGHT: 'trip_flights',
};
type Context = { params: Promise<{ tripId: string; kind: string; itemId: string }> };
export async function PATCH(request: Request, context: Context) {
  const { tripId, kind, itemId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  if (!tables[kind]) return NextResponse.json({ error: 'Invalid reservation' }, { status: 400 });
  const input = await request.json();
  if (typeof input.locked !== 'boolean')
    return NextResponse.json({ error: 'Specify lock state' }, { status: 400 });
  const query = auth.supabase
    .from(tables[kind])
    .select(kind === 'ACTIVITY' ? 'id,trip_days!inner(trip_id)' : 'id')
    .eq('id', itemId)
    .eq(kind === 'ACTIVITY' ? 'trip_days.trip_id' : 'trip_id', tripId);
  const { data } = await query.single();
  if (!data) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
  const { error } = await auth.supabase
    .from(tables[kind])
    .update({ reservation_locked: input.locked })
    .eq('id', itemId);
  return NextResponse.json(error ? { error: error.message } : { locked: input.locked }, {
    status: error ? 409 : 200,
  });
}
