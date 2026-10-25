import { describe, expect, it } from 'vitest';

import { canModifyActivity, canReorderActivity } from './activity-lock';

describe('canModifyActivity', () => {
  it('prevents changes while the activity is locked', () => {
    expect(
      canModifyActivity(
        { reservationLocked: true },
        { canEdit: true, isOnline: true, pending: false },
      ),
    ).toBe(false);
  });

  it('allows changes only for an online editor with no pending mutation', () => {
    expect(
      canModifyActivity(
        { reservationLocked: false },
        { canEdit: true, isOnline: true, pending: false },
      ),
    ).toBe(true);
    expect(
      canModifyActivity(
        { reservationLocked: false },
        { canEdit: false, isOnline: true, pending: false },
      ),
    ).toBe(false);
    expect(
      canModifyActivity(
        { reservationLocked: false },
        { canEdit: true, isOnline: false, pending: false },
      ),
    ).toBe(false);
    expect(
      canModifyActivity(
        { reservationLocked: false },
        { canEdit: true, isOnline: true, pending: true },
      ),
    ).toBe(false);
  });
});

describe('canReorderActivity', () => {
  it('allows an online editor to reorder even when the activity is locked', () => {
    expect(canReorderActivity({ canEdit: true, isOnline: true })).toBe(true);
    expect(canReorderActivity({ canEdit: false, isOnline: true })).toBe(false);
    expect(canReorderActivity({ canEdit: true, isOnline: false })).toBe(false);
    expect(canReorderActivity({ canEdit: true, isOnline: true, pending: true })).toBe(false);
  });
});
