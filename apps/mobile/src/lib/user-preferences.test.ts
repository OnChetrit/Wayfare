import { describe, expect, it } from 'vitest';

import { preferredCurrency } from './user-preferences';

describe('preferredCurrency', () => {
  it('uses the currency from account preferences', () => {
    expect(preferredCurrency({ preferences: { currency: 'ils' } }, 'EUR')).toBe('ILS');
  });

  it('falls back when account preferences do not contain a currency', () => {
    expect(preferredCurrency({ preferences: { currency: 'invalid' } }, 'EUR')).toBe('EUR');
  });
});
