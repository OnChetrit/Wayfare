import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const placeIdSchema = z.uuid();
const updateSchema = z
  .object({
    isFavorite: z.boolean().optional(),
    comment: z.string().trim().max(5_000).optional(),
  })
  .refine(data => data.isFavorite !== undefined || data.comment !== undefined, {
    message: 'Provide a place update.',
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; placeId: string }> },
) {
  const { tripId, placeId: rawPlaceId } = await context.params;
  const placeId = placeIdSchema.safeParse(rawPlaceId);
  if (!placeId.success) return NextResponse.json({ error: 'Invalid saved place' }, { status: 400 });
  const result = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const updates: { is_favorite?: boolean; user_notes?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (result.data.isFavorite !== undefined) updates.is_favorite = result.data.isFavorite;
  if (result.data.comment !== undefined) updates.user_notes = result.data.comment || null;
  const { data, error } = await auth.supabase
    .from('saved_places')
    .update(updates)
    .eq('id', placeId.data)
    .eq('trip_id', tripId)
    .select('id, is_favorite, user_notes')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Saved place not found' }, { status: 404 });
  return NextResponse.json({ place: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tripId: string; placeId: string }> },
) {
  const { tripId, placeId: rawPlaceId } = await context.params;
  const placeId = placeIdSchema.safeParse(rawPlaceId);
  if (!placeId.success) return NextResponse.json({ error: 'Invalid saved place' }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase
    .from('saved_places')
    .delete()
    .eq('id', placeId.data)
    .eq('trip_id', tripId)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Saved place not found' }, { status: 404 });
  return NextResponse.json({ deleted: data.id });
}
