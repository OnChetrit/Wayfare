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
      'id, trip_day_id, saved_place_id, duration_minutes, sort_order, title_override, category, notes, amount, currency, trip_days!inner(trip_id)',
    )
    .eq('id', scheduleId)
    .eq('trip_days.trip_id', tripId)
    .maybeSingle();
  if (itemError || !item) {
    return NextResponse.json({ error: 'Schedule item not found' }, { status: 404 });
  }

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

  const movedToAnotherDay = item.trip_day_id !== day.id;
  const { data: lastTargetDayItem, error: lastTargetDayItemError } = movedToAnotherDay
    ? await auth.supabase
        .from('schedule_items')
        .select('sort_order')
        .eq('trip_day_id', day.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  if (lastTargetDayItemError) {
    return NextResponse.json({ error: lastTargetDayItemError.message }, { status: 400 });
  }

  // Cross-day moves receive a fresh server-issued target-day order. Same-day
  // reorders may request an explicit position and receive it back as the
  // authoritative map refresh value.
  const sortOrder =
    result.data.sortOrder ??
    (movedToAnotherDay ? (lastTargetDayItem?.sort_order ?? -1) + 1 : (item.sort_order ?? 0));

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
      ...(result.data.duration === undefined ? {} : { duration_minutes: result.data.duration }),
      sort_order: sortOrder,
      ...(result.data.note === undefined ? {} : { notes: result.data.note }),
      ...(result.data.title === undefined ? {} : { title_override: result.data.title }),
      ...(result.data.category === undefined ? {} : { category: result.data.category }),
      ...(result.data.savedPlaceId === undefined
        ? {}
        : { saved_place_id: result.data.savedPlaceId }),
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
      savedPlaceId:
        result.data.savedPlaceId === undefined ? item.saved_place_id : result.data.savedPlaceId,
      date: result.data.date,
      startTime: result.data.startTime,
      duration: result.data.duration ?? item.duration_minutes ?? 60,
      sortOrder,
      title:
        result.data.title === undefined
          ? (item.title_override ?? undefined)
          : (result.data.title ?? undefined),
      category:
        result.data.category === undefined
          ? (item.category ?? undefined)
          : (result.data.category ?? undefined),
      note:
        result.data.note === undefined
          ? (item.notes ?? undefined)
          : (result.data.note ?? undefined),
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
