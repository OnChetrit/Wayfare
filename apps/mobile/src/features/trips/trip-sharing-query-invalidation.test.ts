import { describe, expect, it, vi } from 'vitest';

import { invalidateTripSharingData } from './trip-sharing-query-invalidation';

describe('trip sharing mutation refreshes', () => {
  it('invalidates trip summaries, access, invitations, and members', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateTripSharingData({ invalidateQueries }, 'trip-1');

    expect(invalidateQueries).toHaveBeenCalledTimes(4);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trips'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trips', 'trip-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['trips', 'trip-1', 'invitations'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trips', 'trip-1', 'members'] });
  });
});
