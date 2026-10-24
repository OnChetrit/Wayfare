import type { DayItineraryEntry } from '@/features/itinerary/day-itinerary';

export function overviewEntryTarget(entry: DayItineraryEntry) {
  if (entry.kind === 'schedule') return { kind: 'ACTIVITY', itemId: entry.item.id } as const;
  if (entry.kind === 'flight') return { kind: 'FLIGHT', itemId: entry.flight.id } as const;
  return { kind: 'HOTEL', itemId: entry.stay.id } as const;
}
