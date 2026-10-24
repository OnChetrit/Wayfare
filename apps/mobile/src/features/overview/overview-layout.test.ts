import { describe, expect, it } from 'vitest';

import {
  moveOverviewCard,
  overviewLayoutFromMetadata,
  overviewMetadataUpdate,
} from './overview-layout';

describe('overview layout', () => {
  it('defaults to the requested card order and accepts only known unique cards', () => {
    expect(overviewLayoutFromMetadata(null).order).toEqual([
      'locations',
      'flights-stays',
      'expenses',
      'reminders',
    ]);
    expect(
      overviewLayoutFromMetadata({
        preferences: {
          overviewLayout: {
            order: ['expenses', 'expenses', 'unknown'],
            hidden: ['reminders', 'unknown'],
          },
        },
      }),
    ).toEqual({
      order: ['expenses', 'locations', 'flights-stays', 'reminders'],
      hidden: ['reminders'],
    });
  });

  it('reorders and saves while preserving other metadata preferences', () => {
    const current = { full_name: 'A', preferences: { currency: 'EUR', theme: 'dark' } };
    const layout = overviewLayoutFromMetadata(current);
    const next = {
      order: moveOverviewCard(layout.order, 'expenses', -1),
      hidden: ['locations' as const],
    };
    expect(overviewMetadataUpdate(current, next)).toEqual({
      full_name: 'A',
      preferences: { currency: 'EUR', theme: 'dark', overviewLayout: next },
    });
  });
});
