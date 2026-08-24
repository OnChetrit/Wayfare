import { describe, expect, it } from 'vitest';
import { bearerToken } from '../src/lib/supabase/bearer-token';

describe('bearer token authentication', () => {
  it('extracts a Supabase bearer token without accepting malformed headers', () => {
    expect(bearerToken('Bearer mobile-session')).toBe('mobile-session');
    expect(bearerToken('bearer token')).toBe('token');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
