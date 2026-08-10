import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const createTripSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    destinationLabel: z.string().trim().min(1).max(120).optional(),
    defaultTimeZone: z.string().min(1).default('Europe/Madrid'),
    defaultCurrency: z.string().length(3).default('EUR'),
  })
  .refine(input => input.startDate <= input.endDate, {
    message: 'startDate must be before or equal to endDate',
    path: ['endDate'],
  });

export async function GET() {
  if (isSupabaseConfigured()) {
    const cookieClient = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await cookieClient.auth.getSession();
    if (sessionError || !session?.access_token)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const supabase = await createClient(session.access_token);
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    const userId = claimsData?.claims?.sub;
    if (claimsError || userError || !user || !userId || user.id !== userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('start_date', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ trips: data });
  }

  return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
}

export async function POST(request: Request) {
  const result = createTripSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  if (isSupabaseConfigured()) {
    const cookieClient = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await cookieClient.auth.getSession();
    if (sessionError || !session?.access_token)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const supabase = await createClient(session.access_token);
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    const userId = claimsData?.claims?.sub;
    if (claimsError || userError || !user || !userId || user.id !== userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tripId = crypto.randomUUID();
    const trip = {
      id: tripId,
      owner_id: userId,
      name: result.data.name,
      start_date: result.data.startDate,
      end_date: result.data.endDate,
      destination_label: result.data.destinationLabel ?? null,
      default_time_zone: result.data.defaultTimeZone,
      default_currency: result.data.defaultCurrency,
    };
    const { error } = await supabase.from('trips').insert(trip);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const dayRows: Array<{ trip_id: string; local_date: string }> = [];
    const date = new Date(`${result.data.startDate}T12:00:00Z`);
    const endDate = new Date(`${result.data.endDate}T12:00:00Z`);
    while (date <= endDate) {
      dayRows.push({ trip_id: tripId, local_date: date.toISOString().slice(0, 10) });
      date.setUTCDate(date.getUTCDate() + 1);
    }
    const { error: daysError } = await supabase.from('trip_days').insert(dayRows);
    if (daysError) return NextResponse.json({ error: daysError.message }, { status: 500 });
    return NextResponse.json({ trip }, { status: 201 });
  }

  return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
}
