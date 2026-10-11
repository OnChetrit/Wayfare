import type { DocumentTarget, TripDocument } from '@wayfare/domain';

const supportedDocumentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function documentUploadMimeType(name: string, declaredType?: string | null) {
  const declaredTypeLower = declaredType?.toLowerCase();
  const normalizedType = declaredTypeLower === 'image/jpg' ? 'image/jpeg' : declaredTypeLower;
  if (normalizedType && supportedDocumentMimeTypes.has(normalizedType)) return normalizedType;
  const extension = name.split('.').pop()?.toLowerCase();
  return {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }[extension ?? ''];
}

export function documentsForTarget(
  documents: TripDocument[],
  target: DocumentTarget,
  paymentId?: string,
) {
  return documents.filter(document =>
    document.document_links.some(
      link =>
        (link.kind === target.kind && link.item_id === target.itemId) ||
        (Boolean(paymentId) && link.kind === 'EXPENSE' && link.item_id === paymentId),
    ),
  );
}

export function removalTargetForDocument(
  document: TripDocument,
  target: DocumentTarget,
  paymentId?: string,
): DocumentTarget | null {
  const directLink = document.document_links.find(
    link => link.kind === target.kind && link.item_id === target.itemId,
  );
  if (directLink) return { kind: directLink.kind, itemId: directLink.item_id };
  const paymentLink = paymentId
    ? document.document_links.find(link => link.kind === 'EXPENSE' && link.item_id === paymentId)
    : undefined;
  return paymentLink ? { kind: 'EXPENSE', itemId: paymentLink.item_id } : null;
}
