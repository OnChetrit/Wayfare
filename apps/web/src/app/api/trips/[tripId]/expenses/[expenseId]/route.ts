import { NextResponse } from 'next/server';
import { savePayment } from '@/lib/trips/payment-api';
import { requireRouteUser } from '@/lib/supabase/route-auth';
export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; expenseId: string }> },
) {
  const { tripId, expenseId } = await context.params;
  return savePayment(request, tripId, expenseId);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tripId: string; expenseId: string }> },
) {
  const { tripId, expenseId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data: expense, error: expenseError } = await auth.supabase
    .from('trip_expenses')
    .select('stay_id, flight_id')
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .maybeSingle();
  if (expenseError) return NextResponse.json({ error: expenseError.message }, { status: 400 });
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  const { error } = await auth.supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('trip_id', tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: expenseId });
}
