import { describe, expect, it } from 'vitest';
import {
  localDateTimeToUtc,
  scheduleCreateSchema,
  scheduleStartTimeFromUtc,
  scheduleUpdateSchema,
} from './schedule';

describe('schedule time contracts', () => {
  it('normalizes a legacy omitted create time to null and accepts an explicit clear', () => {
    expect(
      scheduleCreateSchema.parse({
        date: '2026-10-10',
        duration: 60,
        title: 'Museum',
      }).startTime,
    ).toBeNull();
    expect(
      scheduleUpdateSchema.parse({ date: '2026-10-10', startTime: null }).startTime,
    ).toBeNull();
  });

  it('keeps a selected local time stable through UTC mapping across DST', () => {
    const utc = localDateTimeToUtc('2026-03-29', '10:30', 'Europe/Madrid');

    expect(utc).toBe('2026-03-29T08:30:00.000Z');
    expect(scheduleStartTimeFromUtc(utc, 'Europe/Madrid')).toBe('10:30');
    expect(scheduleStartTimeFromUtc(null, 'Europe/Madrid')).toBeNull();
  });
});
