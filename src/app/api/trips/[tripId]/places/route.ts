import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const placeSchema = z.object({
  provider: z.enum(['GOOGLE', 'CUSTOM']).default('CUSTOM'),
  providerPlaceId: z.string().max(200).optional(),
  category: z.enum([
    'HOTEL',
    'RESTAURANT',
    'BAR',
    'CAFE',
    'ATTRACTION',
    'SHOPPING',
    'TRANSPORT',
    'CUSTOM',
  ]),
  name: z.string().trim().min(1).max(200),
  lat: z.number().finite(),
  lng: z.number().finite(),
});

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = placeSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const cookieClient = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await cookieClient.auth.getSession();
  if (sessionError || !session?.access_token)
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const supabase = await createClient(session.access_token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { data, error } = await supabase
    .from('saved_places')
    .insert({
      trip_id: tripId,
      provider: result.data.provider,
      provider_place_id: result.data.providerPlaceId ?? null,
      category: result.data.category,
      custom_name: result.data.name,
      custom_latitude: result.data.lat,
      custom_longitude: result.data.lng,
      created_by: user.id,
    })
    .select('id, is_favorite')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ place: data }, { status: 201 });
}
