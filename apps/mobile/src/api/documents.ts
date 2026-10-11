import type {
  DocumentLinkInput,
  DocumentTarget,
  DocumentUpdateInput,
  TripDocument,
} from '@wayfare/domain';

import { requestWayfareApi } from '@/api/client';

function documentsPath(tripId: string) {
  return `/api/trips/${encodeURIComponent(tripId)}/documents`;
}

function documentPath(tripId: string, documentId: string) {
  return `${documentsPath(tripId)}/${encodeURIComponent(documentId)}`;
}

function write<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown) {
  return requestWayfareApi<T>(path, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getTripDocuments(tripId: string, signal?: AbortSignal) {
  const response = await requestWayfareApi<{ documents: TripDocument[] }>(documentsPath(tripId), {
    signal,
  });
  return response.documents;
}

export function createTripDocumentLink(tripId: string, input: DocumentLinkInput) {
  return write<{ id: string }>(documentsPath(tripId), 'POST', input);
}

export function linkExistingTripDocument(
  tripId: string,
  documentId: string,
  target: DocumentTarget,
) {
  return write<{ linked: true }>(documentsPath(tripId), 'POST', { ...target, documentId });
}

export function updateTripDocument(tripId: string, documentId: string, input: DocumentUpdateInput) {
  return write<{ renamed: true }>(documentPath(tripId, documentId), 'PATCH', input);
}

export function removeTripDocument(tripId: string, documentId: string, target: DocumentTarget) {
  return write<{ removed: true }>(documentPath(tripId, documentId), 'DELETE', target);
}

export function getTripDocumentAccess(tripId: string, documentId: string) {
  return requestWayfareApi<{ url: string }>(documentPath(tripId, documentId));
}
