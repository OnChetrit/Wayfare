import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const dayNotesSchema = z.object({
  notes: z.string().trim().max(5000).nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; dayId: string }> },
) {
  const { tripId, dayId } = await context.params;
  const result = dayNotesSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from('trip_days')
    .update({ notes: result.data.notes })
    .eq('id', dayId)
    .eq('trip_id', tripId)
    .select('id, notes')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Day not found' }, { status: 404 });

  return NextResponse.json({ day: data });
}
