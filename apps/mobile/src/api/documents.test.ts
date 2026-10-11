import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTripDocumentLink,
  getTripDocumentAccess,
  getTripDocuments,
  linkExistingTripDocument,
  removeTripDocument,
  updateTripDocument,
} from './documents';

const { requestWayfareApi } = vi.hoisted(() => ({ requestWayfareApi: vi.fn() }));

vi.mock('@/api/client', () => ({ requestWayfareApi }));

const tripId = '00000000-0000-4000-8000-000000000001';
const itemId = '00000000-0000-4000-8000-000000000002';
const documentId = '00000000-0000-4000-8000-000000000003';
const target = { kind: 'ACTIVITY' as const, itemId };

describe('mobile document API', () => {
  beforeEach(() => requestWayfareApi.mockReset());

  it('loads activity documents and their short-lived access URL', async () => {
    requestWayfareApi.mockResolvedValueOnce({ documents: [] }).mockResolvedValueOnce({
      url: 'https://example.com/ticket.pdf',
    });
    const controller = new AbortController();

    await expect(getTripDocuments(tripId, controller.signal)).resolves.toEqual([]);
    await expect(getTripDocumentAccess(tripId, documentId)).resolves.toEqual({
      url: 'https://example.com/ticket.pdf',
    });

    expect(requestWayfareApi).toHaveBeenNthCalledWith(1, `/api/trips/${tripId}/documents`, {
      signal: controller.signal,
    });
    expect(requestWayfareApi).toHaveBeenNthCalledWith(
      2,
      `/api/trips/${tripId}/documents/${documentId}`,
    );
  });

  it('creates, edits, links, and removes activity attachments through the web API', async () => {
    requestWayfareApi.mockResolvedValue({});

    await createTripDocumentLink(tripId, {
      ...target,
      label: 'Museum tickets',
      url: 'https://example.com/tickets',
    });
    await updateTripDocument(tripId, documentId, {
      label: 'Updated tickets',
      url: 'https://example.com/new-tickets',
    });
    await linkExistingTripDocument(tripId, documentId, target);
    await removeTripDocument(tripId, documentId, target);

    expect(requestWayfareApi).toHaveBeenNthCalledWith(1, `/api/trips/${tripId}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        ...target,
        label: 'Museum tickets',
        url: 'https://example.com/tickets',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(requestWayfareApi).toHaveBeenNthCalledWith(
      2,
      `/api/trips/${tripId}/documents/${documentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          label: 'Updated tickets',
          url: 'https://example.com/new-tickets',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(requestWayfareApi).toHaveBeenNthCalledWith(3, `/api/trips/${tripId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ ...target, documentId }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(requestWayfareApi).toHaveBeenNthCalledWith(
      4,
      `/api/trips/${tripId}/documents/${documentId}`,
      {
        method: 'DELETE',
        body: JSON.stringify(target),
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });
});
