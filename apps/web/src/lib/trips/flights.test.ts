import { describe, expect, it } from 'vitest';
import { flightCandidateSchema, flightCandidateToDatabase } from './flights';

describe('flight updates', () => {
  it('maps a replacement flight and clears details missing from the new result', () => {
    const candidate = flightCandidateSchema.parse({
      flightNumber: 'LY316',
      departureDate: '2026-10-10',
      scheduledDepartureLocal: '2026-10-10T09:00:00+03:00',
      scheduledDepartureUtc: '2026-10-10T06:00:00Z',
      status: 'Scheduled',
    });

    expect(flightCandidateToDatabase(candidate)).toMatchObject({
      flight_number: 'LY316',
      departure_date: '2026-10-10',
      scheduled_departure_utc: '2026-10-10T06:00:00Z',
      departure_gate: null,
      arrival_baggage_belt: null,
      status: 'Scheduled',
    });
    expect(flightCandidateToDatabase(candidate)).not.toHaveProperty('id');
    expect(flightCandidateToDatabase(candidate)).not.toHaveProperty('reservation_locked');
  });
});
