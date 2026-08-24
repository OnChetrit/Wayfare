import { NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { localDateTimeToUtc, scheduleUpdateSchema } from '@/lib/trips/schedule';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; scheduleId: string }> },
) {
  const { tripId, scheduleId } = await context.params;
  const result = scheduleUpdateSchema.safeParse(await request.json());
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

  const { data: item, error: itemError } = await auth.supabase
    .from('schedule_items')
    .select(
      'id, trip_day_id, saved_place_id, duration_minutes, title_override, category, notes, amount, currency, trip_days!inner(trip_id)',
    )
    .eq('id', scheduleId)
    .eq('trip_days.trip_id', tripId)
    .maybeSingle();
  if (itemError || !item) {
    return NextResponse.json({ error: 'Schedule item not found' }, { status: 404 });
  }

  const { error: updateError } = await auth.supabase
    .from('schedule_items')
    .update({
      trip_day_id: day.id,
      start_at_utc: localDateTimeToUtc(
        result.data.date,
        result.data.startTime,
        trip.default_time_zone,
      ),
      time_zone: trip.default_time_zone,
      ...(result.data.amount !== undefined
        ? {
            amount: result.data.amount,
            currency: result.data.amount == null ? null : result.data.currency,
          }
        : {}),
    })
    .eq('id', scheduleId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({
    schedule: {
      id: item.id,
      savedPlaceId: item.saved_place_id,
      date: result.data.date,
      startTime: result.data.startTime,
      duration: item.duration_minutes ?? 60,
      title: item.title_override ?? undefined,
      category: item.category ?? undefined,
      note: item.notes ?? undefined,
      amount:
        result.data.amount !== undefined
          ? (result.data.amount ?? undefined)
          : (item.amount ?? undefined),
      currency:
        result.data.amount !== undefined ? result.data.currency : (item.currency ?? undefined),
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tripId: string; scheduleId: string }> },
) {
  const { tripId, scheduleId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  const { data: item, error: itemError } = await auth.supabase
    .from('schedule_items')
    .select('id, trip_days!inner(trip_id)')
    .eq('id', scheduleId)
    .eq('trip_days.trip_id', tripId)
    .maybeSingle();
  if (itemError || !item) {
    return NextResponse.json({ error: 'Schedule item not found' }, { status: 404 });
  }

  const { error: deleteError } = await auth.supabase
    .from('schedule_items')
    .delete()
    .eq('id', scheduleId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  return NextResponse.json({ deleted: item.id });
}
