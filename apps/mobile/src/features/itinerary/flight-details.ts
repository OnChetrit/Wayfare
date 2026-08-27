import type { TripFlight } from '@wayfare/domain';

export type FlightEventKind = 'arrival' | 'departure';

export type FlightEvent = {
  flight: TripFlight;
  kind: FlightEventKind;
};

function airportLabel(iata?: string, name?: string) {
  return iata ?? name ?? 'Airport';
}

function compact(parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(' · ');
}

export function flightRoute(flight: TripFlight) {
  return `${airportLabel(flight.departureAirportIata, flight.departureAirportName)} → ${airportLabel(
    flight.arrivalAirportIata,
    flight.arrivalAirportName,
  )}`;
}

export function flightAirline(flight: TripFlight) {
  return flight.airlineName ?? flight.airlineIata ?? flight.airlineIcao ?? 'Airline unavailable';
}

export function flightEventsForDate(flights: TripFlight[], date: string): FlightEvent[] {
  return flights.flatMap(flight => [
    ...(flight.departureDate === date ? [{ flight, kind: 'departure' as const }] : []),
    ...(flight.arrivalDate === date ? [{ flight, kind: 'arrival' as const }] : []),
  ]);
}

export function flightEventDetail(flight: TripFlight, kind: FlightEventKind) {
  const isArrival = kind === 'arrival';
  return compact([
    flightAirline(flight),
    flight.status,
    isArrival ? flight.scheduledArrivalLocal : flight.scheduledDepartureLocal,
    (isArrival ? flight.arrivalTerminal : flight.departureTerminal)
      ? `Terminal ${isArrival ? flight.arrivalTerminal : flight.departureTerminal}`
      : undefined,
    (isArrival ? flight.arrivalGate : flight.departureGate)
      ? `Gate ${isArrival ? flight.arrivalGate : flight.departureGate}`
      : undefined,
    isArrival && flight.arrivalBaggageBelt ? `Baggage ${flight.arrivalBaggageBelt}` : undefined,
  ]);
}

export function flightDetailRows(flight: TripFlight) {
  return [
    `Airline: ${flightAirline(flight)}`,
    flightRoute(flight),
    `Status: ${flight.status}`,
    compact([
      `Departure: ${flight.scheduledDepartureLocal}`,
      flight.departureTerminal ? `Terminal ${flight.departureTerminal}` : undefined,
      flight.departureGate ? `Gate ${flight.departureGate}` : undefined,
    ]),
    flight.scheduledArrivalLocal
      ? compact([
          `Arrival: ${flight.scheduledArrivalLocal}`,
          flight.arrivalTerminal ? `Terminal ${flight.arrivalTerminal}` : undefined,
          flight.arrivalGate ? `Gate ${flight.arrivalGate}` : undefined,
          flight.arrivalBaggageBelt ? `Baggage ${flight.arrivalBaggageBelt}` : undefined,
        ])
      : undefined,
  ].filter((row): row is string => Boolean(row));
}
