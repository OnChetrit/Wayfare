import { NextResponse } from 'next/server';
import { expenseSelect } from '@/lib/trips/expenses';
import { savePayment } from '@/lib/trips/payment-api';
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
  return savePayment(request, (await context.params).tripId, null);
}
