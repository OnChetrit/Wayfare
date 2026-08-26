import { describe, expect, it } from 'vitest';

import {
  lastTripIdFromMetadata,
  selectedTripIdAfterDeletion,
  selectTripId,
} from './trip-selection';

const trips = [{ id: 'tokyo' }, { id: 'kyoto' }];

describe('trip selection', () => {
  it('restores the last selected trip from user metadata', () => {
    expect(lastTripIdFromMetadata({ lastTripId: 'kyoto' })).toBe('kyoto');
    expect(selectTripId({ lastTripId: 'kyoto', requestedTripId: null, trips })).toBe('kyoto');
  });

  it('uses the current selection before the saved preference', () => {
    expect(selectTripId({ lastTripId: 'kyoto', requestedTripId: 'tokyo', trips })).toBe('tokyo');
  });

  it('selects a newly created trip when it is requested', () => {
    const tripsAfterCreate = [...trips, { id: 'osaka' }];
    expect(
      selectTripId({ lastTripId: 'kyoto', requestedTripId: 'osaka', trips: tripsAfterCreate }),
    ).toBe('osaka');
  });

  it('falls back safely when a saved trip no longer exists', () => {
    expect(selectTripId({ lastTripId: 'removed-trip', requestedTripId: null, trips })).toBe(
      'tokyo',
    );
    expect(lastTripIdFromMetadata({ lastTripId: 12 })).toBeNull();
    expect(selectTripId({ lastTripId: null, requestedTripId: null, trips: [] })).toBeNull();
  });

  it('selects the first remaining trip after deleting the current selection', () => {
    expect(
      selectedTripIdAfterDeletion({ deletedTripId: 'tokyo', selectedTripId: 'tokyo', trips }),
    ).toBe('kyoto');
  });

  it('clears the selection after deleting the final trip', () => {
    expect(
      selectedTripIdAfterDeletion({
        deletedTripId: 'tokyo',
        selectedTripId: 'tokyo',
        trips: [{ id: 'tokyo' }],
      }),
    ).toBeNull();
  });
});
