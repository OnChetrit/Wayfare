import { z } from 'zod';
export const documentMaxBytes = 20 * 1024 * 1024;
export const documentTargetSchema = z.object({
  kind: z.enum(['ACTIVITY', 'HOTEL', 'FLIGHT', 'PLACE', 'EXPENSE']),
  itemId: z.uuid(),
});
export const documentLinkInputSchema = documentTargetSchema.extend({
  label: z.string().trim().min(1).max(200),
  url: z
    .url()
    .refine(
      value => ['http:', 'https:'].includes(new URL(value).protocol),
      'Use an HTTP or HTTPS link.',
    ),
});
export type DocumentTarget = z.infer<typeof documentTargetSchema>;
export type TripDocument = {
  id: string;
  label: string;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  byte_size: number | null;
  document_links: { kind: DocumentTarget['kind']; item_id: string }[];
};
export function documentContentType(bytes: Uint8Array): string | null {
  const prefix = (values: number[]) => values.every((value, index) => bytes[index] === value);
  if (prefix([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (prefix([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (prefix([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (
    prefix([0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp';
  return null;
}
