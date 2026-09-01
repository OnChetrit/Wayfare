import { reminderCompletionTime, reminderUpdateSchema } from '@wayfare/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import {
  getPersonalReminder,
  serializePersonalReminder,
  updatePersonalReminder,
} from '@/lib/trips/reminders';

const reminderIdSchema = z.uuid();

async function canReadTrip(supabase: SupabaseClient, tripId: string) {
  const { data, error } = await supabase.from('trips').select('id').eq('id', tripId).maybeSingle();
  if (error) throw new Error(`Could not load trip: ${error.message}`);
  return Boolean(data);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; reminderId: string }> },
) {
  const { tripId, reminderId: rawReminderId } = await context.params;
  const reminderId = reminderIdSchema.safeParse(rawReminderId);
  if (!reminderId.success) return NextResponse.json({ error: 'Invalid reminder' }, { status: 400 });
  const result = reminderUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  try {
    if (!(await canReadTrip(auth.supabase, tripId))) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    const existing = await getPersonalReminder(auth.supabase, tripId, reminderId.data);
    if (!existing) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });

    const completedAt = result.data.status
      ? reminderCompletionTime(existing.status, result.data.status, existing.completed_at)
      : undefined;
    const updated = await updatePersonalReminder(
      auth.supabase,
      tripId,
      reminderId.data,
      result.data,
      completedAt,
    );
    if (!updated) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    return NextResponse.json({
      reminder: await serializePersonalReminder(auth.supabase, tripId, updated),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update reminder' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tripId: string; reminderId: string }> },
) {
  const { tripId, reminderId: rawReminderId } = await context.params;
  const reminderId = reminderIdSchema.safeParse(rawReminderId);
  if (!reminderId.success) return NextResponse.json({ error: 'Invalid reminder' }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  try {
    if (!(await canReadTrip(auth.supabase, tripId))) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    const existing = await getPersonalReminder(auth.supabase, tripId, reminderId.data);
    if (!existing) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    const { error } = await auth.supabase
      .from('personal_reminders')
      .delete()
      .eq('id', reminderId.data)
      .eq('trip_id', tripId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ deleted: reminderId.data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not delete reminder' },
      { status: 400 },
    );
  }
}
