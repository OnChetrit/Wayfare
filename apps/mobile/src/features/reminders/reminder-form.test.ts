import { describe, expect, it } from 'vitest';

import { reminderInputFromForm, reminderUtcFromLocal } from './reminder-form';

describe('reminder form', () => {
  it('converts a device-local date and time to a UTC API payload', () => {
    expect(reminderUtcFromLocal('2030-06-10 09:30')).toMatch(/Z$/);
  });

  it('requires exactly one source and a future time', () => {
    const future = new Date(Date.now() + 60 * 60_000);
    const local = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')} ${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
    const result = reminderInputFromForm(
      {
        sourceKind: 'SAVED_PLACE',
        savedPlaceId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f41',
      },
      { title: 'Call Luna', body: 'Book a table', remindAtLocal: local },
    );
    expect('data' in result).toBe(true);
  });
});
