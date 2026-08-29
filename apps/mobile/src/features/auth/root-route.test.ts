import { describe, expect, it } from 'vitest';

import { rootScreenForAuth } from './root-route';

describe('root authentication route', () => {
  it('waits for session restoration before rendering a destination', () => {
    expect(rootScreenForAuth(false, false)).toBe('loading');
    expect(rootScreenForAuth(false, true)).toBe('loading');
  });

  it('shows onboarding only to an unauthenticated user', () => {
    expect(rootScreenForAuth(true, false)).toBe('onboarding');
  });

  it('redirects an authenticated user to the itinerary', () => {
    expect(rootScreenForAuth(true, true)).toBe('itinerary');
  });
});
