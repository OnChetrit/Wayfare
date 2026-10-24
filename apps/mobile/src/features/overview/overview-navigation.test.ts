import { describe, expect, it } from 'vitest';
import type { DayItineraryEntry } from '@/features/itinerary/day-itinerary';

import { overviewEntryTarget } from './overview-navigation';

describe('Overview item navigation', () => {
  it('opens the existing detail target for each timeline item', () => {
    const schedule = { kind: 'schedule', item: { id: 'activity-id' } } as DayItineraryEntry;
    const flight = { kind: 'flight', flight: { id: 'flight-id' } } as DayItineraryEntry;
    const stay = { kind: 'stay', stay: { id: 'stay-id' } } as DayItineraryEntry;
    expect(overviewEntryTarget(schedule)).toEqual({ kind: 'ACTIVITY', itemId: 'activity-id' });
    expect(overviewEntryTarget(flight)).toEqual({ kind: 'FLIGHT', itemId: 'flight-id' });
    expect(overviewEntryTarget(stay)).toEqual({ kind: 'HOTEL', itemId: 'stay-id' });
  });
});
