import { reminderCreateSchema, type ReminderSourceKind } from '@wayfare/domain';

import type { ReminderCreateRequest } from '@/api/trips';

export type ReminderFormValues = {
  body: string;
  remindAtLocal: string;
  title: string;
};

export type ReminderSource = {
  savedPlaceId?: string;
  scheduleItemId?: string;
  sourceKind: ReminderSourceKind;
};

export function reminderInputFromForm(
  source: ReminderSource,
  form: ReminderFormValues,
): { data: ReminderCreateRequest } | { error: string } {
  if (!form.body.trim()) return { error: 'Enter a reminder message.' };
  const remindAt = reminderUtcFromLocal(form.remindAtLocal);
  if (!remindAt) return { error: 'Use a valid local date and time.' };
  const result = reminderCreateSchema.safeParse({
    sourceKind: source.sourceKind,
    savedPlaceId: source.savedPlaceId ?? null,
    scheduleItemId: source.scheduleItemId ?? null,
    title: form.title,
    body: form.body,
    remindAt,
  });
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Enter valid reminder details.';
    return { error: message };
  }
  return { data: result.data };
}

export function localReminderDateTime(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function reminderUtcFromLocal(value: string) {
  const normalized = value.trim().replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
