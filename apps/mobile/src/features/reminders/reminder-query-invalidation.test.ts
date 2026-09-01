import { describe, expect, it, vi } from 'vitest';

import { invalidateReminderData } from './reminder-query-invalidation';

describe('personal reminder mutation refreshes', () => {
  it('invalidates only the selected trip reminder cache', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateReminderData({ invalidateQueries }, 'trip-1');

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trips', 'trip-1', 'reminders'] });
  });
});
