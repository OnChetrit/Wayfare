import { NextResponse } from 'next/server';
import { moneyMinorUnits, validateAllocation } from '@wayfare/domain';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { expenseSchema, expenseUpdateSchema, expenseSelect } from './expenses';

export async function savePayment(request: Request, tripId: string, expenseId: string | null) {
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = (expenseId ? expenseUpdateSchema : expenseSchema).safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues.map(issue => issue.message).join(' ') },
      { status: 400 },
    );
  const payload = { ...parsed.data };
  if (expenseId) {
    const { data: current } = await auth.supabase
      .from('trip_expenses')
      .select('version,currency,amount,expense_items(id)')
      .eq('trip_id', tripId)
      .eq('id', expenseId)
      .single();
    if (!current) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    if (!payload.coverage && current.expense_items.length > 1)
      return NextResponse.json(
        { error: 'Update the app to edit this shared payment.', code: 'CLIENT_UPDATE_REQUIRED' },
        { status: 409 },
      );
    payload.expectedVersion ??= current.version;
    payload.currency ??= current.currency;
    payload.amount ??= Number(current.amount);
  }
  if (!payload.coverage && ['stayId', 'flightId', 'scheduleItemId'].some(key => key in payload)) {
    payload.coverage = payload.stayId
      ? [{ kind: 'HOTEL', itemId: payload.stayId }]
      : payload.flightId
        ? [{ kind: 'FLIGHT', itemId: payload.flightId }]
        : payload.scheduleItemId
          ? [{ kind: 'ACTIVITY', itemId: payload.scheduleItemId }]
          : [];
  }
  try {
    moneyMinorUnits(payload.amount!, payload.currency!);
    if (payload.coverage) validateAllocation(payload.amount!, payload.currency!, payload.coverage);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const { data, error } = await auth.supabase.rpc('save_payment', {
    target_trip: tripId,
    target_id: expenseId,
    payload,
  });
  if (error)
    return NextResponse.json(
      { error: error.message, code: error.message.split(':')[0] },
      { status: /REQUIRED|STALE_VERSION/.test(error.message) ? 409 : 400 },
    );
  const row = Array.isArray(data) ? data[0] : data;
  const { data: expense, error: readError } = await auth.supabase
    .from('trip_expenses')
    .select(expenseSelect)
    .eq('id', row.id)
    .single();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  return NextResponse.json({ expense }, { status: expenseId ? 200 : 201 });
}
