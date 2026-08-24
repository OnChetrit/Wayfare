import { NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { expenseSelect } from '@/lib/trips/expenses';
import { staySelect, stayUpdateSchema } from '@/lib/trips/stays';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; stayId: string }> },
) {
  const { tripId, stayId } = await context.params;
  const result = stayUpdateSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data: current, error: currentError } = await auth.supabase
    .from('stays')
    .select(staySelect)
    .eq('id', stayId)
    .eq('trip_id', tripId)
    .single();
  if (currentError || !current)
    return NextResponse.json({ error: 'Stay not found' }, { status: 404 });

  const next = {
    name: result.data.name ?? current.name,
    savedPlaceId:
      result.data.savedPlaceId === undefined ? current.saved_place_id : result.data.savedPlaceId,
    address: result.data.address === undefined ? current.address : result.data.address,
    locationLabel:
      result.data.locationLabel === undefined ? current.location_label : result.data.locationLabel,
    price: result.data.price === undefined ? current.price : result.data.price,
    priceAmount:
      result.data.priceAmount === undefined ? current.price_amount : result.data.priceAmount,
    priceCurrency:
      result.data.priceCurrency === undefined ? current.price_currency : result.data.priceCurrency,
    cancellationTime:
      result.data.cancellationTime === undefined
        ? current.cancellation_time
        : result.data.cancellationTime,
    checkInDate: result.data.checkInDate ?? current.check_in_date,
    checkOutDate: result.data.checkOutDate ?? current.check_out_date,
    checkInTime:
      result.data.checkInTime === undefined ? current.check_in_time : result.data.checkInTime,
    checkOutTime:
      result.data.checkOutTime === undefined ? current.check_out_time : result.data.checkOutTime,
    confirmationNumber:
      result.data.confirmationNumber === undefined
        ? current.confirmation_number
        : result.data.confirmationNumber,
    secretCode: result.data.secretCode === undefined ? current.secret_code : result.data.secretCode,
    notes: result.data.notes === undefined ? current.notes : result.data.notes,
  };
  if (next.checkInDate >= next.checkOutDate)
    return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 });

  const { data: trip } = await auth.supabase
    .from('trips')
    .select('start_date, end_date')
    .eq('id', tripId)
    .single();
  if (!trip || next.checkInDate < trip.start_date || next.checkOutDate > trip.end_date)
    return NextResponse.json(
      { error: 'Stay dates must be inside the trip dates' },
      { status: 400 },
    );

  if (next.savedPlaceId) {
    const { data: savedPlace } = await auth.supabase
      .from('saved_places')
      .select('id')
      .eq('id', next.savedPlaceId)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (!savedPlace)
      return NextResponse.json(
        { error: 'Saved place does not belong to this trip' },
        { status: 400 },
      );
  }

  const { data, error } = await auth.supabase
    .from('stays')
    .update({
      name: next.name,
      saved_place_id: next.savedPlaceId,
      address: next.address,
      location_label: next.locationLabel,
      price: next.price,
      price_amount: next.priceAmount,
      price_currency: next.priceAmount == null ? null : next.priceCurrency,
      cancellation_time: next.cancellationTime,
      check_in_date: next.checkInDate,
      check_out_date: next.checkOutDate,
      check_in_time: next.checkInTime,
      check_out_time: next.checkOutTime,
      confirmation_number: next.confirmationNumber,
      secret_code: next.secretCode,
      notes: next.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stayId)
    .eq('trip_id', tripId)
    .select(staySelect)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: expense } = await auth.supabase
    .from('trip_expenses')
    .select(expenseSelect)
    .eq('stay_id', stayId)
    .maybeSingle();
  return NextResponse.json({ stay: data, expense });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tripId: string; stayId: string }> },
) {
  const { tripId, stayId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase
    .from('stays')
    .delete()
    .eq('id', stayId)
    .eq('trip_id', tripId)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
  return NextResponse.json({ deleted: data.id });
}
