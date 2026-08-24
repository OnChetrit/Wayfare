import { NextResponse } from 'next/server';
import { expenseSelect, expenseUpdateSchema } from '@/lib/trips/expenses';
import { validateExpenseSource, validateTripExpense } from '@/lib/trips/expense-validation';
import { requireRouteUser } from '@/lib/supabase/route-auth';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; expenseId: string }> },
) {
  const { tripId, expenseId } = await context.params;
  const result = expenseUpdateSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data: current, error: currentError } = await auth.supabase
    .from('trip_expenses')
    .select('expense_date, currency, stay_id, flight_id, schedule_item_id')
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .single();
  if (currentError || !current)
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  if (
    (current.stay_id || current.flight_id) &&
    ['title', 'category', 'expenseDate', 'stayId', 'flightId', 'scheduleItemId'].some(
      key => key in result.data,
    )
  ) {
    return NextResponse.json(
      { error: 'Linked stay and flight details are managed from the itinerary.' },
      { status: 400 },
    );
  }
  const expenseDate = result.data.expenseDate ?? current.expense_date;
  const currency = result.data.currency ?? current.currency;
  const tripError = await validateTripExpense(auth.supabase, tripId, expenseDate, currency);
  if (tripError) return NextResponse.json({ error: tripError }, { status: 400 });
  const sourceError = await validateExpenseSource(auth.supabase, tripId, {
    stayId: result.data.stayId === undefined ? current.stay_id : result.data.stayId,
    flightId: result.data.flightId === undefined ? current.flight_id : result.data.flightId,
    scheduleItemId:
      result.data.scheduleItemId === undefined
        ? current.schedule_item_id
        : result.data.scheduleItemId,
  });
  if (sourceError) return NextResponse.json({ error: sourceError }, { status: 400 });
  const update = Object.fromEntries(
    Object.entries(result.data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value]),
  );
  const { data, error } = await auth.supabase
    .from('trip_expenses')
    .update(update)
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .select(expenseSelect)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ expense: data });
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
  if (expense.stay_id || expense.flight_id) {
    return NextResponse.json(
      { error: 'Expenses linked to stays and flights are managed with those itinerary items.' },
      { status: 400 },
    );
  }
  const { error } = await auth.supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('trip_id', tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: expenseId });
}
