import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { expenseSelect } from '@/lib/trips/expenses';
import { stayWithPriceSchema, staySelect } from '@/lib/trips/stays';

async function validateTripDates(
  supabase: SupabaseClient,
  tripId: string,
  checkInDate: string,
  checkOutDate: string,
) {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('start_date, end_date')
    .eq('id', tripId)
    .single();
  if (error || !trip) return 'Trip not found';
  if (checkInDate < trip.start_date || checkOutDate > trip.end_date) {
    return 'Stay dates must be inside the trip dates';
  }
  return null;
}

async function validateSavedPlace(
  supabase: SupabaseClient,
  tripId: string,
  savedPlaceId: string | null | undefined,
) {
  if (!savedPlaceId) return null;
  const { data } = await supabase
    .from('saved_places')
    .select('id')
    .eq('id', savedPlaceId)
    .eq('trip_id', tripId)
    .maybeSingle();
  return data ? null : 'Saved place does not belong to this trip';
}

export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase
    .from('stays')
    .select(staySelect)
    .eq('trip_id', tripId)
    .order('check_in_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stays: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = stayWithPriceSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const dateError = await validateTripDates(
    auth.supabase,
    tripId,
    result.data.checkInDate,
    result.data.checkOutDate,
  );
  const placeError = await validateSavedPlace(auth.supabase, tripId, result.data.savedPlaceId);
  if (dateError || placeError)
    return NextResponse.json({ error: dateError ?? placeError }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('stays')
    .insert({
      trip_id: tripId,
      name: result.data.name,
      saved_place_id: result.data.savedPlaceId ?? null,
      address: result.data.address ?? null,
      location_label: result.data.locationLabel ?? null,
      price: result.data.price ?? null,
      price_amount: result.data.priceAmount ?? null,
      price_currency: result.data.priceAmount == null ? null : result.data.priceCurrency,
      cancellation_time: result.data.cancellationTime ?? null,
      check_in_date: result.data.checkInDate,
      check_out_date: result.data.checkOutDate,
      check_in_time: result.data.checkInTime ?? null,
      check_out_time: result.data.checkOutTime ?? null,
      confirmation_number: result.data.confirmationNumber ?? null,
      secret_code: result.data.secretCode ?? null,
      notes: result.data.notes ?? null,
    })
    .select(staySelect)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: expense } = await auth.supabase
    .from('trip_expenses')
    .select(expenseSelect)
    .eq('stay_id', data.id)
    .maybeSingle();
  return NextResponse.json({ stay: data, expense }, { status: 201 });
}
