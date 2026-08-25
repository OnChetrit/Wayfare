import { describe, expect, it } from 'vitest';

import { formatDuration, formatMoney } from './format';

describe('mobile formatting', () => {
  it('formats itinerary durations compactly', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('formats money using the provided currency', () => {
    expect(formatMoney(12.5, 'EUR')).toContain('12.50');
  });
});
