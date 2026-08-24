import type { SupabaseClient } from '@supabase/supabase-js';

export async function validateExpenseSource(
  supabase: SupabaseClient,
  tripId: string,
  source: { stayId?: string | null; flightId?: string | null; scheduleItemId?: string | null },
) {
  if (source.stayId) {
    const { data } = await supabase
      .from('stays')
      .select('id')
      .eq('id', source.stayId)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (!data) return 'That hotel does not belong to this trip';
  }
  if (source.flightId) {
    const { data } = await supabase
      .from('trip_flights')
      .select('id')
      .eq('id', source.flightId)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (!data) return 'That flight does not belong to this trip';
  }
  if (source.scheduleItemId) {
    const { data } = await supabase
      .from('schedule_items')
      .select('id, trip_days!inner(trip_id)')
      .eq('id', source.scheduleItemId)
      .eq('trip_days.trip_id', tripId)
      .maybeSingle();
    if (!data) return 'That activity does not belong to this trip';
  }
  return null;
}

export async function validateTripExpense(
  supabase: SupabaseClient,
  tripId: string,
  expenseDate: string,
  currency: string,
) {
  const { data } = await supabase
    .from('trips')
    .select('start_date, end_date, default_currency')
    .eq('id', tripId)
    .maybeSingle();
  if (!data) return 'Trip not found';
  if (expenseDate < data.start_date || expenseDate > data.end_date) {
    return 'Expense date must be inside the trip dates';
  }
  void currency;
  return null;
}
