import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { expenseSelect } from '@/lib/trips/expenses';
const schema = z.object({
  expenses: z.array(z.object({ id: z.uuid(), version: z.number().int().positive() })).min(2),
  paymentStatus: z.enum(['PAID', 'UNPAID']),
});
export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Choose payments and a status.' }, { status: 400 });
  const { data, error } = await auth.supabase.rpc('combine_payments', {
    target_trip: tripId,
    selections: parsed.data.expenses,
    chosen_status: parsed.data.paymentStatus,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  const { data: expense, error: readError } = await auth.supabase
    .from('trip_expenses')
    .select(expenseSelect)
    .eq('id', data)
    .single();
  return NextResponse.json(readError ? { error: readError.message } : { expense }, {
    status: readError ? 500 : 200,
  });
}
