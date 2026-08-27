import { describe, expect, it } from 'vitest';

import { inviteTokenFromRoute, inviteTokenFromUrl } from './invite-link';

describe('invitation deep links', () => {
  it('extracts a token from native and universal invitation links', () => {
    expect(inviteTokenFromUrl('wayfare://invite/abc_123-xyz')).toBe('abc_123-xyz');
    expect(inviteTokenFromUrl('https://wayfare.example/invite/abc123')).toBe('abc123');
  });

  it('rejects malformed route and URL tokens', () => {
    expect(inviteTokenFromUrl('wayfare://invite/one/two')).toBeNull();
    expect(inviteTokenFromUrl('wayfare://other/abc123')).toBeNull();
    expect(inviteTokenFromRoute(['abc123', 'other'])).toBeNull();
    expect(inviteTokenFromRoute('invalid token')).toBeNull();
  });
});
