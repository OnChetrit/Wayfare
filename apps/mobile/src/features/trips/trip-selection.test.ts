import { describe, expect, it } from 'vitest';

import { lastTripIdFromMetadata, selectTripId } from './trip-selection';

const trips = [{ id: 'tokyo' }, { id: 'kyoto' }];

describe('trip selection', () => {
  it('restores the last selected trip from user metadata', () => {
    expect(lastTripIdFromMetadata({ lastTripId: 'kyoto' })).toBe('kyoto');
    expect(selectTripId({ lastTripId: 'kyoto', requestedTripId: null, trips })).toBe('kyoto');
  });

  it('uses the current selection before the saved preference', () => {
    expect(selectTripId({ lastTripId: 'kyoto', requestedTripId: 'tokyo', trips })).toBe('tokyo');
  });

  it('falls back safely when a saved trip no longer exists', () => {
    expect(selectTripId({ lastTripId: 'removed-trip', requestedTripId: null, trips })).toBe(
      'tokyo',
    );
    expect(lastTripIdFromMetadata({ lastTripId: 12 })).toBeNull();
    expect(selectTripId({ lastTripId: null, requestedTripId: null, trips: [] })).toBeNull();
  });
});
