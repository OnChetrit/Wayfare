import { describe, expect, it } from 'vitest';

import type { TripFlight } from '@wayfare/domain';
import {
  flightDetailRows,
  flightEventDetail,
  flightEventsForDate,
  flightRoute,
} from './flight-details';

const flight: TripFlight = {
  id: 'flight-1',
  tripId: 'trip-1',
  flightNumber: 'LY 315',
  airlineName: 'El Al',
  departureDate: '2026-10-10',
  arrivalDate: '2026-10-10',
  departureAirportIata: 'TLV',
  arrivalAirportIata: 'FCO',
  scheduledDepartureLocal: '2026-10-10T08:10:00+03:00',
  scheduledDepartureUtc: '2026-10-10T05:10:00Z',
  scheduledArrivalLocal: '2026-10-10T10:50:00+02:00',
  scheduledArrivalUtc: '2026-10-10T08:50:00Z',
  departureTerminal: '3',
  departureGate: 'D6',
  arrivalTerminal: '1',
  arrivalGate: 'B4',
  arrivalBaggageBelt: '7',
  status: 'scheduled',
};

describe('flight details', () => {
  it('creates arrival and departure timeline events on the appropriate day', () => {
    expect(flightEventsForDate([flight], '2026-10-10').map(event => event.kind)).toEqual([
      'departure',
      'arrival',
    ]);
    expect(flightEventsForDate([flight], '2026-10-11')).toEqual([]);
  });

  it('keeps route, terminal, gate, and baggage context available to itinerary views', () => {
    expect(flightRoute(flight)).toBe('TLV → FCO');
    expect(flightEventDetail(flight, 'arrival')).toContain('Baggage 7');
    expect(flightDetailRows(flight)).toEqual(
      expect.arrayContaining([
        'Airline: El Al',
        'TLV → FCO',
        'Status: scheduled',
        expect.stringContaining('Terminal 3'),
        expect.stringContaining('Terminal 1'),
        expect.stringContaining('Baggage 7'),
      ]),
    );
  });
});
