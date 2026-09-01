import {
  reminderSchema,
  type Reminder,
  type ReminderCreateInput,
  type ReminderUpdateInput,
} from '@wayfare/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

const reminderSelect =
  'id, trip_id, user_id, source_kind, saved_place_id, schedule_item_id, source_title_snapshot, source_body_snapshot, title, body, remind_at, status, completed_at, created_at, updated_at';

type ReminderRow = {
  id: string;
  trip_id: string;
  user_id: string;
  source_kind: 'SAVED_PLACE' | 'SCHEDULE_ITEM';
  saved_place_id: string | null;
  schedule_item_id: string | null;
  source_title_snapshot: string;
  source_body_snapshot: string;
  title: string;
  body: string;
  remind_at: string;
  status: 'OPEN' | 'COMPLETED';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SavedPlaceRow = { id: string; custom_name: string | null; user_notes?: string | null };
type ScheduleRow = {
  id: string;
  saved_place_id: string | null;
  title_override: string | null;
  notes?: string | null;
};

type SourceDetails = {
  sourceTitle: string;
  sourceBody: string;
};

type SourceTitles = {
  savedPlaceTitles: Map<string, string>;
  scheduleItemTitles: Map<string, string>;
};

export class ReminderSourceError extends Error {}

function sourceText(value: string | null | undefined, fallback: string, maxLength: number) {
  return (value?.trim() || fallback).slice(0, maxLength);
}

function utcIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Reminder has an invalid timestamp.');
  return date.toISOString();
}

function reminderFromRow(row: ReminderRow, sourceTitles: SourceTitles): Reminder {
  const sourceId = row.source_kind === 'SAVED_PLACE' ? row.saved_place_id : row.schedule_item_id;
  const sourceTitle =
    (row.source_kind === 'SAVED_PLACE'
      ? sourceId
        ? sourceTitles.savedPlaceTitles.get(sourceId)
        : undefined
      : sourceId
        ? sourceTitles.scheduleItemTitles.get(sourceId)
        : undefined) ?? row.source_title_snapshot;
  const sourceAvailable = Boolean(
    sourceId &&
    (row.source_kind === 'SAVED_PLACE'
      ? sourceTitles.savedPlaceTitles.has(sourceId)
      : sourceTitles.scheduleItemTitles.has(sourceId)),
  );

  return reminderSchema.parse({
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    sourceKind: row.source_kind,
    savedPlaceId: row.saved_place_id,
    scheduleItemId: row.schedule_item_id,
    sourceTitleSnapshot: row.source_title_snapshot,
    sourceBodySnapshot: row.source_body_snapshot,
    sourceTitle,
    sourceAvailable,
    title: row.title,
    body: row.body,
    remindAt: utcIso(row.remind_at),
    status: row.status,
    completedAt: row.completed_at ? utcIso(row.completed_at) : null,
    createdAt: utcIso(row.created_at),
    updatedAt: utcIso(row.updated_at),
  });
}

async function sourceTitlesForRows(
  supabase: SupabaseClient,
  tripId: string,
  rows: ReminderRow[],
): Promise<SourceTitles> {
  const savedPlaceIds = new Set(
    rows.flatMap(row => (row.saved_place_id ? [row.saved_place_id] : [])),
  );
  const scheduleItemIds = rows.flatMap(row => (row.schedule_item_id ? [row.schedule_item_id] : []));
  const { data: scheduleRows, error: scheduleError } = scheduleItemIds.length
    ? await supabase
        .from('schedule_items')
        .select('id, saved_place_id, title_override')
        .in('id', scheduleItemIds)
    : { data: [] as ScheduleRow[], error: null };
  if (scheduleError) throw new Error(`Could not load reminder sources: ${scheduleError.message}`);

  (scheduleRows ?? []).forEach(row => {
    if (row.saved_place_id) savedPlaceIds.add(row.saved_place_id);
  });

  const { data: savedPlaceRows, error: savedPlaceError } = savedPlaceIds.size
    ? await supabase
        .from('saved_places')
        .select('id, custom_name')
        .eq('trip_id', tripId)
        .in('id', [...savedPlaceIds])
    : { data: [] as SavedPlaceRow[], error: null };
  if (savedPlaceError)
    throw new Error(`Could not load reminder sources: ${savedPlaceError.message}`);

  const savedPlaceTitles = new Map(
    (savedPlaceRows ?? []).map(row => [row.id, sourceText(row.custom_name, 'Saved place', 200)]),
  );
  const scheduleItemTitles = new Map(
    (scheduleRows ?? []).map(row => [
      row.id,
      sourceText(
        row.title_override,
        row.saved_place_id ? (savedPlaceTitles.get(row.saved_place_id) ?? 'Activity') : 'Activity',
        200,
      ),
    ]),
  );

  return { savedPlaceTitles, scheduleItemTitles };
}

async function reminderForRow(
  supabase: SupabaseClient,
  tripId: string,
  row: ReminderRow,
): Promise<Reminder> {
  return reminderFromRow(row, await sourceTitlesForRows(supabase, tripId, [row]));
}

export async function listPersonalReminders(
  supabase: SupabaseClient,
  tripId: string,
  status?: 'OPEN' | 'COMPLETED',
): Promise<Reminder[]> {
  let query = supabase
    .from('personal_reminders')
    .select(reminderSelect)
    .eq('trip_id', tripId)
    .order('remind_at', { ascending: status !== 'COMPLETED' });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load reminders: ${error.message}`);

  const rows = (data ?? []) as ReminderRow[];
  const sourceTitles = await sourceTitlesForRows(supabase, tripId, rows);
  return rows.map(row => reminderFromRow(row, sourceTitles));
}

export async function getPersonalReminder(
  supabase: SupabaseClient,
  tripId: string,
  reminderId: string,
): Promise<ReminderRow | null> {
  const { data, error } = await supabase
    .from('personal_reminders')
    .select(reminderSelect)
    .eq('id', reminderId)
    .eq('trip_id', tripId)
    .maybeSingle();
  if (error) throw new Error(`Could not load reminder: ${error.message}`);
  return (data as ReminderRow | null) ?? null;
}

export async function serializePersonalReminder(
  supabase: SupabaseClient,
  tripId: string,
  row: ReminderRow,
) {
  return reminderForRow(supabase, tripId, row);
}

async function currentSourceDetails(
  supabase: SupabaseClient,
  tripId: string,
  input: ReminderCreateInput,
): Promise<SourceDetails> {
  if (input.sourceKind === 'SAVED_PLACE') {
    const { data, error } = await supabase
      .from('saved_places')
      .select('id, custom_name, user_notes')
      .eq('id', input.savedPlaceId!)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (error) throw new Error(`Could not load reminder source: ${error.message}`);
    if (!data) throw new ReminderSourceError('Saved place does not belong to this trip.');
    const body = data.user_notes?.trim();
    if (!body) throw new ReminderSourceError('This saved-place comment is no longer available.');
    return {
      sourceTitle: sourceText(data.custom_name, 'Saved place', 200),
      sourceBody: sourceText(body, '', 5_000),
    };
  }

  const { data: scheduleItem, error: scheduleError } = await supabase
    .from('schedule_items')
    .select('id, saved_place_id, title_override, notes, trip_days!inner(trip_id)')
    .eq('id', input.scheduleItemId!)
    .eq('trip_days.trip_id', tripId)
    .maybeSingle();
  if (scheduleError) throw new Error(`Could not load reminder source: ${scheduleError.message}`);
  if (!scheduleItem) throw new ReminderSourceError('Itinerary item does not belong to this trip.');
  const body = scheduleItem.notes?.trim();
  if (!body) throw new ReminderSourceError('This itinerary note is no longer available.');

  let savedPlaceTitle: string | undefined;
  if (scheduleItem.saved_place_id) {
    const { data: savedPlace, error: savedPlaceError } = await supabase
      .from('saved_places')
      .select('custom_name')
      .eq('id', scheduleItem.saved_place_id)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (savedPlaceError)
      throw new Error(`Could not load reminder source: ${savedPlaceError.message}`);
    savedPlaceTitle = savedPlace?.custom_name ?? undefined;
  }

  return {
    sourceTitle: sourceText(scheduleItem.title_override, savedPlaceTitle ?? 'Activity', 200),
    sourceBody: sourceText(body, '', 5_000),
  };
}

export async function createPersonalReminder(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
  input: ReminderCreateInput,
) {
  const source = await currentSourceDetails(supabase, tripId, input);
  const { data, error } = await supabase
    .from('personal_reminders')
    .insert({
      trip_id: tripId,
      user_id: userId,
      source_kind: input.sourceKind,
      saved_place_id: input.savedPlaceId,
      schedule_item_id: input.scheduleItemId,
      source_title_snapshot: source.sourceTitle,
      source_body_snapshot: source.sourceBody,
      title: input.title,
      body: input.body,
      remind_at: input.remindAt,
    })
    .select(reminderSelect)
    .single();
  if (error) throw new Error(`Could not create reminder: ${error.message}`);
  return reminderForRow(supabase, tripId, data as ReminderRow);
}

export async function updatePersonalReminder(
  supabase: SupabaseClient,
  tripId: string,
  reminderId: string,
  input: ReminderUpdateInput,
  completedAt: string | null | undefined,
) {
  const updates = {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.body === undefined ? {} : { body: input.body }),
    ...(input.remindAt === undefined ? {} : { remind_at: input.remindAt }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(completedAt === undefined ? {} : { completed_at: completedAt }),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('personal_reminders')
    .update(updates)
    .eq('id', reminderId)
    .eq('trip_id', tripId)
    .select(reminderSelect)
    .maybeSingle();
  if (error) throw new Error(`Could not update reminder: ${error.message}`);
  return (data as ReminderRow | null) ?? null;
}
