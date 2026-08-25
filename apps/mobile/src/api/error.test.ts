import { describe, expect, it } from 'vitest';

import {
  apiErrorMessage,
  isAuthenticationError,
  isSessionInvalidError,
  WayfareApiError,
} from './error';

describe('API error handling', () => {
  it('uses a structured API message when one is available', () => {
    expect(apiErrorMessage({ error: { message: 'Trip not found' } }, 'Fallback')).toBe(
      'Trip not found',
    );
    expect(apiErrorMessage({ error: 'Not allowed' }, 'Fallback')).toBe('Not allowed');
  });

  it('does not retry authentication errors', () => {
    expect(isAuthenticationError(new WayfareApiError('Sign in again', 401))).toBe(true);
    expect(isAuthenticationError(new WayfareApiError('Offline', 0))).toBe(false);
  });

  it('only flags a Supabase-confirmed invalid session for sign-out', () => {
    expect(isSessionInvalidError(new WayfareApiError('Expired', 401, 'SESSION_INVALID'))).toBe(
      true,
    );
    expect(isSessionInvalidError(new WayfareApiError('API rejected token', 401, 'AUTH'))).toBe(
      false,
    );
  });
});
