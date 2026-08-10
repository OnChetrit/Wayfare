import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const idSchema = z.uuid();
const bodySchema = z.object({ savedPlaceId: z.uuid() });

async function isTripLocation(
  tripId: string,
  segmentId: string,
  supabase: SupabaseClient,
) {
  const { data, error } = await supabase
    .from('trip_location_segments')
    .select('id')
    .eq('id', segmentId)
    .eq('trip_id', tripId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tripId: string; segmentId: string }> },
) {
  const { tripId, segmentId } = await context.params;
  if (!idSchema.safeParse(segmentId).success)
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
  const result = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  try {
    if (!(await isTripLocation(tripId, segmentId, auth.supabase)))
      return NextResponse.json({ error: 'Trip location not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read location' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('trip_location_segment_places')
    .upsert({ location_segment_id: segmentId, saved_place_id: result.data.savedPlaceId })
    .select('location_segment_id, saved_place_id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ locationPlace: data }, { status: 201 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ tripId: string; segmentId: string }> },
) {
  const { tripId, segmentId } = await context.params;
  const result = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!idSchema.safeParse(segmentId).success || !result.success)
    return NextResponse.json({ error: 'Invalid location place' }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  try {
    if (!(await isTripLocation(tripId, segmentId, auth.supabase)))
      return NextResponse.json({ error: 'Trip location not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read location' }, { status: 400 });
  }
  const { data, error } = await auth.supabase
    .from('trip_location_segment_places')
    .delete()
    .eq('location_segment_id', segmentId)
    .eq('saved_place_id', result.data.savedPlaceId)
    .select('saved_place_id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Location place not found' }, { status: 404 });
  return NextResponse.json({ removed: data.saved_place_id });
}
