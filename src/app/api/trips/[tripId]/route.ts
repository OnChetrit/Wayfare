import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const tripSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    destinationLabel: z.string().trim().max(120).nullable(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    defaultTimeZone: z.string().trim().min(1).max(80),
    defaultCurrency: z.string().trim().length(3).toUpperCase(),
  })
  .refine(input => input.startDate <= input.endDate, {
    message: 'Your return date needs to be after your start date.',
    path: ['endDate'],
  });

type TripDayRow = {
  id: string;
  local_date: string;
  title: string | null;
  notes: string | null;
};

function toTripDays(rows: TripDayRow[]) {
  return rows.map(row => {
    const date = new Date(`${row.local_date}T12:00:00Z`);
    return {
      id: row.id,
      date: row.local_date,
      label: new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date),
      weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
        .format(date)
        .toUpperCase(),
      shortDate: new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(date),
      notes: row.notes ?? undefined,
    };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = tripSettingsSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  const { error: updateError } = await auth.supabase.rpc('update_trip_settings', {
    target_trip_id: tripId,
    trip_name: result.data.name,
    trip_destination_label: result.data.destinationLabel,
    trip_start_date: result.data.startDate,
    trip_end_date: result.data.endDate,
    trip_time_zone: result.data.defaultTimeZone,
    trip_currency: result.data.defaultCurrency,
  });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  const [{ data: trip, error: finalTripError }, { data: days, error: finalDaysError }] =
    await Promise.all([
      auth.supabase
        .from('trips')
        .select(
          'id, name, start_date, end_date, destination_label, default_time_zone, default_currency',
        )
        .eq('id', tripId)
        .single(),
      auth.supabase
        .from('trip_days')
        .select('id, local_date, title, notes')
        .eq('trip_id', tripId)
        .order('local_date'),
    ]);
  if (finalTripError || !trip)
    return NextResponse.json(
      { error: finalTripError?.message ?? 'Could not load the updated trip.' },
      { status: 500 },
    );
  if (finalDaysError) return NextResponse.json({ error: finalDaysError.message }, { status: 500 });

  return NextResponse.json({
    trip: {
      name: trip.name,
      startDate: trip.start_date,
      endDate: trip.end_date,
      destinationLabel: trip.destination_label,
      defaultTimeZone: trip.default_time_zone,
      defaultCurrency: trip.default_currency,
      days: toTripDays((days ?? []) as TripDayRow[]),
    },
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data)
    return NextResponse.json({ error: 'Trip not found or cannot be deleted.' }, { status: 404 });

  return NextResponse.json({ deleted: data.id });
}
