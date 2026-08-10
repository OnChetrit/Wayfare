import { z } from 'zod';
import { currencySchema } from './currencies';

export const scheduleCategorySchema = z.enum([
  'HOTEL',
  'RESTAURANT',
  'BAR',
  'CAFE',
  'ATTRACTION',
  'SHOPPING',
  'TRANSPORT',
  'CUSTOM',
]);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'A valid start time is required');

export const scheduleUpdateSchema = z
  .object({
    date: z.iso.date(),
    startTime: timeSchema,
    amount: z.number().finite().nonnegative().nullable().optional(),
    currency: currencySchema.optional(),
  })
  .refine(value => value.amount == null || value.amount === undefined || value.currency, {
    message: 'Currency is required when an amount is provided',
    path: ['currency'],
  });

export const scheduleCreateSchema = z
  .object({
    date: z.iso.date(),
    startTime: timeSchema,
    duration: z.number().int().min(15).max(1440),
    savedPlaceId: z.string().uuid().nullable().optional(),
    title: z.string().trim().max(200).optional(),
    category: scheduleCategorySchema.optional(),
    note: z.string().trim().max(1000).optional(),
    amount: z.number().finite().nonnegative().nullable().optional(),
    currency: currencySchema.optional(),
  })
  .refine(value => value.savedPlaceId || value.title, 'A saved place or activity title is required')
  .refine(value => value.amount == null || value.currency, {
    message: 'Currency is required when an amount is provided',
    path: ['currency'],
  });

export const scheduleSelect =
  'id, trip_day_id, saved_place_id, start_at_utc, time_zone, duration_minutes, sort_order, title_override, category, notes, amount, currency';

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

/** Convert a trip-local date/time into the UTC value used by schedule_items. */
export function localDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wallClock;

  // Recalculate the offset after the first correction so DST transitions are handled.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getTimeZoneParts(new Date(utc), timeZone);
    const formattedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    utc = wallClock - (formattedAsUtc - utc);
  }

  return new Date(utc).toISOString();
}
