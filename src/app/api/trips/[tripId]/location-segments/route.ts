import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const splitSchema = z.object({
  sourceSegmentId: z.uuid(),
  splitDate: z.iso.date(),
  locationName: z.string().trim().min(1).max(160),
});

export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from('trip_location_segments')
    .select('id, trip_id, location_name, country, area, latitude, longitude, start_date, end_date')
    .eq('trip_id', tripId)
    .order('start_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segments: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = splitSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase.rpc('split_trip_location_segment', {
    source_segment_id: result.data.sourceSegmentId,
    split_date: result.data.splitDate,
    new_location_name: result.data.locationName,
    new_country: null,
    new_area: null,
    new_latitude: null,
    new_longitude: null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const segments = (data ?? []).filter(
    (segment: { trip_id?: string }) => segment.trip_id === tripId,
  );
  if (!segments.length)
    return NextResponse.json({ error: 'Trip location segment not found' }, { status: 404 });
  return NextResponse.json({ segments }, { status: 201 });
}
