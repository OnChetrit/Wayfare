import { z } from 'zod';
export const reservationMetadataSchema = z.object({
  reservationLocked: z.boolean().default(false),
  mutationVersion: z.number().int().positive().default(1),
});
export const reservationConfirmationSchema = z.object({
  code: z.literal('RESERVATION_CONFIRMATION_REQUIRED'),
  id: z.uuid().optional(),
  version: z.number().int().positive().optional(),
  reservations: z
    .array(z.object({ id: z.uuid(), version: z.number().int().positive(), title: z.string() }))
    .optional(),
  title: z.string(),
  changes: z.record(z.string(), z.unknown()),
});
export function reservationConfirmation(payload: unknown) {
  try {
    const error = (payload as { error?: unknown })?.error;
    return reservationConfirmationSchema.safeParse(
      typeof error === 'string' ? JSON.parse(error) : payload,
    );
  } catch {
    return reservationConfirmationSchema.safeParse(null);
  }
}

export function reservationAcknowledgements(change: z.infer<typeof reservationConfirmationSchema>) {
  return change.reservations
    ? Object.fromEntries(change.reservations.map(item => [item.id, item.version]))
    : change.id && change.version
      ? { [change.id]: change.version }
      : {};
}
export function reservationChangeSummary(change: z.infer<typeof reservationConfirmationSchema>) {
  return [
    change.title,
    ...(change.reservations?.map(item => item.title) ?? []),
    ...Object.entries(change.changes).map(
      ([key, value]) => `${key.replaceAll('_', ' ')}: ${String(value)}`,
    ),
  ].join('\n');
}
