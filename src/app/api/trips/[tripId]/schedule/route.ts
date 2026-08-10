import { NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { localDateTimeToUtc, scheduleCreateSchema } from '@/lib/trips/schedule';

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = scheduleCreateSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  const { data: trip, error: tripError } = await auth.supabase
    .from('trips')
    .select('id, default_time_zone')
    .eq('id', tripId)
    .single();
  if (tripError || !trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const { data: day, error: dayError } = await auth.supabase
    .from('trip_days')
    .select('id')
    .eq('trip_id', tripId)
    .eq('local_date', result.data.date)
    .single();
  if (dayError || !day)
    return NextResponse.json({ error: 'That date is not part of this trip' }, { status: 400 });

  if (result.data.savedPlaceId) {
    const { data: savedPlace } = await auth.supabase
      .from('saved_places')
      .select('id')
      .eq('id', result.data.savedPlaceId)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (!savedPlace)
      return NextResponse.json(
        { error: 'Saved place does not belong to this trip' },
        { status: 400 },
      );
  }

  const { data: lastItem } = await auth.supabase
    .from('schedule_items')
    .select('sort_order')
    .eq('trip_day_id', day.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await auth.supabase
    .from('schedule_items')
    .insert({
      trip_day_id: day.id,
      saved_place_id: result.data.savedPlaceId ?? null,
      start_at_utc: localDateTimeToUtc(
        result.data.date,
        result.data.startTime,
        trip.default_time_zone,
      ),
      time_zone: trip.default_time_zone,
      duration_minutes: result.data.duration,
      sort_order: (lastItem?.sort_order ?? -1) + 1,
      title_override: result.data.title ?? null,
      category: result.data.category ?? null,
      notes: result.data.note ?? null,
      amount: result.data.amount ?? null,
      currency: result.data.amount == null ? null : result.data.currency,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(
    {
      schedule: {
        id: data.id,
        savedPlaceId: result.data.savedPlaceId ?? null,
        date: result.data.date,
        startTime: result.data.startTime,
        duration: result.data.duration,
        title: result.data.title,
        category: result.data.category,
        note: result.data.note,
        amount: result.data.amount ?? undefined,
        currency: result.data.amount == null ? undefined : result.data.currency,
      },
    },
    { status: 201 },
  );
}
