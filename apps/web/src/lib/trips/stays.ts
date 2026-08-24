import { z } from 'zod';
import { currencySchema } from './currencies';

export const stayFieldsSchema = {
  name: z.string().trim().min(1).max(200),
  savedPlaceId: z.uuid().nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  locationLabel: z.string().trim().max(160).nullable().optional(),
  price: z.string().trim().max(100).nullable().optional(),
  priceAmount: z.number().finite().nonnegative().nullable().optional(),
  priceCurrency: currencySchema.optional(),
  cancellationTime: z.string().trim().max(100).nullable().optional(),
  checkInDate: z.iso.date(),
  checkOutDate: z.iso.date(),
  checkInTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  checkOutTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  confirmationNumber: z.string().trim().max(160).nullable().optional(),
  secretCode: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
};

export const staySchema = z
  .object(stayFieldsSchema)
  .refine(value => value.checkInDate < value.checkOutDate, {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  });

export const stayWithPriceSchema = staySchema.refine(
  value => value.priceAmount == null || Boolean(value.priceCurrency),
  { message: 'Currency is required when a price is provided', path: ['priceCurrency'] },
);

export const stayUpdateSchema = z
  .object({
    name: stayFieldsSchema.name.optional(),
    savedPlaceId: stayFieldsSchema.savedPlaceId,
    address: stayFieldsSchema.address,
    locationLabel: stayFieldsSchema.locationLabel,
    price: stayFieldsSchema.price,
    priceAmount: stayFieldsSchema.priceAmount,
    priceCurrency: stayFieldsSchema.priceCurrency,
    cancellationTime: stayFieldsSchema.cancellationTime,
    checkInDate: stayFieldsSchema.checkInDate.optional(),
    checkOutDate: stayFieldsSchema.checkOutDate.optional(),
    checkInTime: stayFieldsSchema.checkInTime,
    checkOutTime: stayFieldsSchema.checkOutTime,
    confirmationNumber: stayFieldsSchema.confirmationNumber,
    secretCode: stayFieldsSchema.secretCode,
    notes: stayFieldsSchema.notes,
  })
  .refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' })
  .refine(value => value.priceAmount == null || Boolean(value.priceCurrency), {
    message: 'Currency is required when a price is provided',
    path: ['priceCurrency'],
  });

export const staySelect =
  'id, trip_id, name, saved_place_id, address, location_label, price, price_amount, price_currency, cancellation_time, check_in_date, check_out_date, check_in_time, check_out_time, confirmation_number, secret_code, notes';
