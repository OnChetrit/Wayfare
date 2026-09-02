import { describe, expect, it } from 'vitest';

import type { Reminder } from '@wayfare/domain';

import {
  isReminderNotificationData,
  isUpcomingOpenReminder,
  reminderNotificationBody,
  reminderNotificationData,
  reminderNotificationTitle,
} from './reminder-notification-content';

const reminder: Reminder = {
  body: 'Confirm the restaurant reservation.',
  completedAt: null,
  createdAt: '2030-01-01T00:00:00.000Z',
  id: '018f7f0e-7c54-7b24-a9d2-4e3683c98f41',
  remindAt: '2030-06-10T09:30:00.000Z',
  savedPlaceId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f42',
  scheduleItemId: null,
  sourceAvailable: true,
  sourceBodySnapshot: 'Ask for a terrace table.',
  sourceKind: 'SAVED_PLACE',
  sourceTitle: 'Luna',
  sourceTitleSnapshot: 'Luna',
  status: 'OPEN',
  title: 'Call Luna',
  tripId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f43',
  updatedAt: '2030-01-01T00:00:00.000Z',
  userId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f44',
};

describe('reminder notification content', () => {
  it('uses private reminder data and opens the reminders list', () => {
    const data = reminderNotificationData(reminder);

    expect(data).toEqual({
      reminderId: reminder.id,
      tripId: reminder.tripId,
      url: '/reminders',
    });
    expect(isReminderNotificationData(data)).toBe(true);
    expect(isReminderNotificationData({ url: '/reminders' })).toBe(false);
  });

  it('schedules only upcoming open reminders and falls back to the source title', () => {
    expect(isUpcomingOpenReminder(reminder, Date.parse('2030-06-10T09:00:00.000Z'))).toBe(true);
    expect(isUpcomingOpenReminder({ ...reminder, status: 'COMPLETED' }, 0)).toBe(false);
    expect(reminderNotificationBody({ ...reminder, body: '   ' })).toBe('Luna');
    expect(reminderNotificationTitle(reminder)).toBe('Luna');
  });
});
