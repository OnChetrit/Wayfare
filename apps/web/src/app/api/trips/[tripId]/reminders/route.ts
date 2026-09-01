import { reminderCreateSchema, reminderStatusSchema } from '@wayfare/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import {
  createPersonalReminder,
  listPersonalReminders,
  ReminderSourceError,
} from '@/lib/trips/reminders';

async function canReadTrip(supabase: SupabaseClient, tripId: string) {
  const { data, error } = await supabase.from('trips').select('id').eq('id', tripId).maybeSingle();
  if (error) throw new Error(`Could not load trip: ${error.message}`);
  return Boolean(data);
}

export async function GET(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const rawStatus = new URL(request.url).searchParams.get('status');
  const status = rawStatus ? reminderStatusSchema.safeParse(rawStatus) : null;
  if (rawStatus && !status?.success) {
    return NextResponse.json({ error: 'Invalid reminder status' }, { status: 400 });
  }

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  try {
    if (!(await canReadTrip(auth.supabase, tripId))) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    const reminders = await listPersonalReminders(auth.supabase, tripId, status?.data);
    return NextResponse.json({ reminders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load reminders' },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = reminderCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  try {
    if (!(await canReadTrip(auth.supabase, tripId))) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    const reminder = await createPersonalReminder(auth.supabase, auth.user.id, tripId, result.data);
    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ReminderSourceError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Could not create reminder',
      },
      { status: 400 },
    );
  }
}
