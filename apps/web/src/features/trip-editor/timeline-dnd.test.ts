import { describe, expect, it } from 'vitest';
import { reorderTimelineItems } from './timeline-dnd';

const items = [{ id: 'breakfast' }, { id: 'museum' }, { id: 'dinner' }];

describe('timeline drag and drop', () => {
  it('moves an earlier card after a later drop target', () => {
    expect(reorderTimelineItems(items, 'breakfast', 'dinner', 'after')).toEqual([
      { id: 'museum' },
      { id: 'dinner' },
      { id: 'breakfast' },
    ]);
  });

  it('moves a later card before an earlier drop target', () => {
    expect(reorderTimelineItems(items, 'dinner', 'breakfast', 'before')).toEqual([
      { id: 'dinner' },
      { id: 'breakfast' },
      { id: 'museum' },
    ]);
  });

  it('leaves the list unchanged for an invalid or identical target', () => {
    expect(reorderTimelineItems(items, 'museum', 'museum', 'after')).toEqual(items);
    expect(reorderTimelineItems(items, 'museum', 'missing', 'before')).toEqual(items);
  });
});
