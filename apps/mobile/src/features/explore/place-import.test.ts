import { describe, expect, it } from 'vitest';

import { googleMapsImportNotice } from './place-import';

describe('googleMapsImportNotice', () => {
  it('reports imported and skipped places from a shared list', () => {
    expect(
      googleMapsImportNotice({
        listName: 'Rome favorites',
        places: [],
        importedCount: 2,
        skippedCount: 1,
      }),
    ).toBe('Imported 2 places from Rome favorites. 1 already existed or could not be read.');
  });
});
