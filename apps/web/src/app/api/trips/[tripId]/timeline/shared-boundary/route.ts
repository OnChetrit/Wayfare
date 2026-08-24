import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { staySelect } from '@/lib/trips/stays';

const sharedBoundarySchema = z.object({
  leftSegmentId: z.uuid(),
  rightSegmentId: z.uuid(),
  stayId: z.uuid(),
  newBoundary: z.iso.date(),
});

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = sharedBoundarySchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data: segments, error } = await auth.supabase.rpc('move_shared_timeline_boundary', {
    left_segment_id: result.data.leftSegmentId,
    right_segment_id: result.data.rightSegmentId,
    stay_id: result.data.stayId,
    new_boundary: result.data.newBoundary,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: stay, error: stayError } = await auth.supabase
    .from('stays')
    .select(staySelect)
    .eq('id', result.data.stayId)
    .eq('trip_id', tripId)
    .single();
  if (stayError || !stay) return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
  const tripSegments = (segments ?? []).filter(
    (segment: { trip_id?: string }) => segment.trip_id === tripId,
  );
  if (!tripSegments.length)
    return NextResponse.json({ error: 'Trip location segment not found' }, { status: 404 });
  return NextResponse.json({ segments: tripSegments, stay });
}
