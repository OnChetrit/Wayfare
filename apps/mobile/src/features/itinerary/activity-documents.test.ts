import { describe, expect, it } from 'vitest';
import type { TripDocument } from '@wayfare/domain';

import {
  documentUploadMimeType,
  documentsForTarget,
  removalTargetForDocument,
} from './activity-documents';

const documents: TripDocument[] = [
  {
    id: 'activity-file',
    label: 'Activity ticket',
    url: null,
    storage_path: 'trip/activity-file',
    mime_type: 'application/pdf',
    byte_size: 120,
    document_links: [{ kind: 'ACTIVITY', item_id: 'activity-1' }],
  },
  {
    id: 'receipt',
    label: 'Shared receipt',
    url: 'https://example.com/receipt',
    storage_path: null,
    mime_type: null,
    byte_size: null,
    document_links: [{ kind: 'EXPENSE', item_id: 'expense-1' }],
  },
  {
    id: 'other',
    label: 'Other activity',
    url: 'https://example.com/other',
    storage_path: null,
    mime_type: null,
    byte_size: null,
    document_links: [{ kind: 'ACTIVITY', item_id: 'activity-2' }],
  },
];

describe('activity documents', () => {
  it('normalizes picker MIME types and falls back to the selected file extension', () => {
    expect(documentUploadMimeType('ticket.bin', 'image/jpg')).toBe('image/jpeg');
    expect(documentUploadMimeType('ticket.PDF', null)).toBe('application/pdf');
    expect(documentUploadMimeType('ticket.exe', null)).toBeUndefined();
  });

  it('shows direct attachments and receipts from the activity payment', () => {
    expect(
      documentsForTarget(documents, { kind: 'ACTIVITY', itemId: 'activity-1' }, 'expense-1').map(
        document => document.id,
      ),
    ).toEqual(['activity-file', 'receipt']);
  });

  it('removes the exact link that made a document visible on the activity', () => {
    const target = { kind: 'ACTIVITY' as const, itemId: 'activity-1' };

    expect(removalTargetForDocument(documents[0], target, 'expense-1')).toEqual(target);
    expect(removalTargetForDocument(documents[1], target, 'expense-1')).toEqual({
      kind: 'EXPENSE',
      itemId: 'expense-1',
    });
    expect(removalTargetForDocument(documents[2], target, 'expense-1')).toBeNull();
  });
});
