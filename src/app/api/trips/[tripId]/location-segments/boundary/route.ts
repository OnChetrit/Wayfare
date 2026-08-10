import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const boundarySchema = z.object({
  leftSegmentId: z.uuid(),
  rightSegmentId: z.uuid(),
  newBoundary: z.iso.date(),
});

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = boundarySchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase.rpc('move_trip_location_boundary', {
    left_segment_id: result.data.leftSegmentId,
    right_segment_id: result.data.rightSegmentId,
    new_boundary: result.data.newBoundary,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const segments = (data ?? []).filter(
    (segment: { trip_id?: string }) => segment.trip_id === tripId,
  );
  if (!segments.length)
    return NextResponse.json({ error: 'Trip location segment not found' }, { status: 404 });
  return NextResponse.json({ segments });
}
