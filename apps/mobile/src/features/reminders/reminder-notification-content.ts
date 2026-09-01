import type { Reminder } from '@wayfare/domain';

export const reminderNotificationUrl = '/reminders';

export type ReminderNotificationData = {
  reminderId: string;
  tripId: string;
  url: typeof reminderNotificationUrl;
};

export function isUpcomingOpenReminder(reminder: Reminder, now = Date.now()) {
  return reminder.status === 'OPEN' && new Date(reminder.remindAt).getTime() > now;
}

export function reminderNotificationData(reminder: Reminder): ReminderNotificationData {
  return {
    reminderId: reminder.id,
    tripId: reminder.tripId,
    url: reminderNotificationUrl,
  };
}

export function reminderNotificationBody(reminder: Reminder) {
  return reminder.body.trim() || reminder.sourceTitle;
}

export function isReminderNotificationData(value: unknown): value is ReminderNotificationData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.reminderId === 'string' &&
    typeof data.tripId === 'string' &&
    data.url === reminderNotificationUrl
  );
}
