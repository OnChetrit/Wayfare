import { describe, expect, it } from 'vitest';

import { tripKeys } from './query-keys';

describe('trip query keys', () => {
  it('keeps a detail query inside the trips cache namespace', () => {
    expect(tripKeys.all).toEqual(['trips']);
    expect(tripKeys.detail('trip-1')).toEqual(['trips', 'trip-1']);
  });
});
