import { describe, expect, it } from 'vitest';

import { reminderSourceForSchedule } from './schedule-reminder';

describe('itinerary activity reminders', () => {
  it('uses the saved place name and activity time as the reminder defaults', () => {
    expect(
      reminderSourceForSchedule(
        {
          date: '2030-06-10',
          id: 'schedule-1',
          savedPlaceId: 'place-1',
          startTime: '09:30',
          title: 'Breakfast',
        },
        [{ id: 'place-1', name: 'Luna' }],
      ),
    ).toEqual({ remindAtLocal: '2030-06-10 09:30', sourceTitle: 'Luna' });
  });

  it('uses the custom activity title and a morning default for untimed activities', () => {
    expect(
      reminderSourceForSchedule(
        {
          date: '2030-06-10',
          id: 'schedule-1',
          savedPlaceId: null,
          startTime: null,
          title: 'Museum visit',
        },
        [],
      ),
    ).toEqual({ remindAtLocal: '2030-06-10 09:00', sourceTitle: 'Museum visit' });
  });
});
