import { describe, expect, it, vi } from 'vitest';
import { invalidateTripData } from './trip-query-invalidation';

describe('trip mutation refreshes', () => {
  it('invalidates the map-owning trip response after a schedule reorder', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateTripData({ invalidateQueries }, 'trip-1');

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trips', 'trip-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trips'] });
  });
});
