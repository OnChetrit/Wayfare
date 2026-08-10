import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const updateSchema = z
  .object({
    locationName: z.string().trim().min(1).max(160).optional(),
    country: z.string().trim().max(120).nullable().optional(),
    area: z.string().trim().max(120).nullable().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    latitude: z.number().finite().min(-90).max(90).nullable().optional(),
    longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' })
  .refine(
    value =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.startDate < value.endDate,
    { message: 'Location start date must be before its end date', path: ['endDate'] },
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; segmentId: string }> },
) {
  const { tripId, segmentId } = await context.params;
  const result = updateSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const update = {
    ...(result.data.locationName === undefined ? {} : { location_name: result.data.locationName }),
    ...(result.data.country === undefined ? {} : { country: result.data.country }),
    ...(result.data.area === undefined ? {} : { area: result.data.area }),
    ...(result.data.startDate === undefined ? {} : { start_date: result.data.startDate }),
    ...(result.data.endDate === undefined ? {} : { end_date: result.data.endDate }),
    ...(result.data.latitude === undefined ? {} : { latitude: result.data.latitude }),
    ...(result.data.longitude === undefined ? {} : { longitude: result.data.longitude }),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await auth.supabase
    .from('trip_location_segments')
    .update(update)
    .eq('id', segmentId)
    .eq('trip_id', tripId)
    .select('id, trip_id, location_name, country, area, latitude, longitude, start_date, end_date')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ segment: data });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ tripId: string; segmentId: string }> },
) {
  const { tripId, segmentId } = await context.params;
  const body = z
    .object({ neighborSegmentId: z.uuid().optional() })
    .safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  if (!body.data.neighborSegmentId) {
    const { data: deleted, error: deleteError } = await auth.supabase
      .from('trip_location_segments')
      .delete()
      .eq('id', segmentId)
      .eq('trip_id', tripId)
      .select('id')
      .maybeSingle();
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
    if (!deleted)
      return NextResponse.json({ error: 'Trip location segment not found' }, { status: 404 });

    const { data: segments, error: segmentsError } = await auth.supabase
      .from('trip_location_segments')
      .select(
        'id, trip_id, location_name, country, area, latitude, longitude, start_date, end_date',
      )
      .eq('trip_id', tripId)
      .order('start_date');
    if (segmentsError) return NextResponse.json({ error: segmentsError.message }, { status: 500 });
    return NextResponse.json({ segments: segments ?? [] });
  }

  const { data, error } = await auth.supabase.rpc('merge_trip_location_segment', {
    segment_id: segmentId,
    neighbor_segment_id: body.data.neighborSegmentId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const segments = (data ?? []).filter(
    (segment: { trip_id?: string }) => segment.trip_id === tripId,
  );
  return NextResponse.json({ segments });
}
