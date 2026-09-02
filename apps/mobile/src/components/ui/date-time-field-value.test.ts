import { describe, expect, it } from 'vitest';

import { dateTimeFieldValue, dateTimePickerDate } from './date-time-field-value';

describe('date-time field values', () => {
  it('round-trips a local date without a UTC date shift', () => {
    const pickerDate = dateTimePickerDate('2026-10-12', 'date');

    expect(dateTimeFieldValue(pickerDate, 'date')).toBe('2026-10-12');
  });

  it('keeps time values in the expected 24-hour format', () => {
    const pickerDate = dateTimePickerDate('09:05', 'time');

    expect(dateTimeFieldValue(pickerDate, 'time')).toBe('09:05');
  });
});
