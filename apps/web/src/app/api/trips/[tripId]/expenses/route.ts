import { NextResponse } from 'next/server';
import { expenseSchema, expenseSelect } from '@/lib/trips/expenses';
import { validateExpenseSource, validateTripExpense } from '@/lib/trips/expense-validation';
import { requireRouteUser } from '@/lib/supabase/route-auth';

export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase
    .from('trip_expenses')
    .select(expenseSelect)
    .eq('trip_id', tripId)
    .order('expense_date')
    .order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = expenseSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const tripError = await validateTripExpense(
    auth.supabase,
    tripId,
    result.data.expenseDate,
    result.data.currency,
  );
  if (tripError) return NextResponse.json({ error: tripError }, { status: 400 });
  const sourceError = await validateExpenseSource(auth.supabase, tripId, result.data);
  if (sourceError) return NextResponse.json({ error: sourceError }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('trip_expenses')
    .insert({
      trip_id: tripId,
      title: result.data.title,
      category: result.data.category,
      amount: result.data.amount,
      currency: result.data.currency,
      expense_date: result.data.expenseDate,
      notes: result.data.notes ?? null,
      stay_id: result.data.stayId ?? null,
      flight_id: result.data.flightId ?? null,
      schedule_item_id: result.data.scheduleItemId ?? null,
      created_by: auth.user.id,
    })
    .select(expenseSelect)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ expense: data }, { status: 201 });
}
