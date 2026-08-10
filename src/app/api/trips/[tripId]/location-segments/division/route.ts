import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const divisionSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  locationName: z.string().trim().min(1).max(160),
});

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = divisionSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase.rpc('create_trip_location_division', {
    target_trip_id: tripId,
    division_start: result.data.startDate,
    division_end: result.data.endDate,
    new_location_name: result.data.locationName,
    new_country: null,
    new_area: null,
    new_latitude: null,
    new_longitude: null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ segments: data ?? [] }, { status: 201 });
}
