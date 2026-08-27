import { describe, expect, it } from 'vitest';

import {
  accountMetadataUpdate,
  accountPreferencesFromMetadata,
  displayNameFromMetadata,
} from './account-preferences';

describe('account preferences', () => {
  it('parses supported metadata values and falls back safely', () => {
    expect(
      accountPreferencesFromMetadata({ preferences: { currency: 'ils', theme: 'dark' } }),
    ).toEqual({ currency: 'ILS', theme: 'dark' });
    expect(
      accountPreferencesFromMetadata({ preferences: { currency: 'invalid', theme: 'neon' } }),
    ).toEqual({
      currency: 'EUR',
      theme: 'system',
    });
  });

  it('preserves unrelated metadata while updating display name and account preferences', () => {
    expect(
      accountMetadataUpdate(
        {
          avatar_url: 'https://example.com/avatar.png',
          lastTripId: 'trip-1',
          preferences: { timeZone: 'Asia/Jerusalem', currency: 'EUR', theme: 'system' },
        },
        { displayName: '  Ada Lovelace  ', preferences: { currency: 'USD', theme: 'light' } },
      ),
    ).toEqual({
      avatar_url: 'https://example.com/avatar.png',
      full_name: 'Ada Lovelace',
      lastTripId: 'trip-1',
      preferences: { timeZone: 'Asia/Jerusalem', currency: 'USD', theme: 'light' },
    });
    expect(displayNameFromMetadata({ name: '  Grace  ' })).toBe('Grace');
  });
});
