import { z } from 'zod';

export type TripFlight = {
  id: string;
  tripId: string;
  flightNumber: string;
  airlineName?: string;
  airlineIata?: string;
  airlineIcao?: string;
  departureDate: string;
  arrivalDate?: string;
  departureAirportIata?: string;
  departureAirportIcao?: string;
  departureAirportName?: string;
  departureTimeZone?: string;
  arrivalAirportIata?: string;
  arrivalAirportIcao?: string;
  arrivalAirportName?: string;
  arrivalTimeZone?: string;
  scheduledDepartureLocal: string;
  scheduledDepartureUtc: string;
  scheduledArrivalLocal?: string;
  scheduledArrivalUtc?: string;
  revisedDepartureLocal?: string;
  revisedArrivalLocal?: string;
  departureTerminal?: string;
  departureGate?: string;
  departureCheckInDesk?: string;
  arrivalTerminal?: string;
  arrivalGate?: string;
  arrivalBaggageBelt?: string;
  status: string;
  durationMinutes?: number;
  aircraftModel?: string;
  aircraftRegistration?: string;
  lastUpdatedUtc?: string;
};

export type TripFlightCandidate = Omit<TripFlight, 'id' | 'tripId'>;

const nullableString = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .transform(value => value ?? undefined);

export const flightCandidateSchema = z.object({
  flightNumber: z.string().trim().min(2).max(20),
  airlineName: nullableString,
  airlineIata: nullableString,
  airlineIcao: nullableString,
  departureDate: z.iso.date(),
  arrivalDate: z.iso
    .date()
    .nullish()
    .transform(value => value ?? undefined),
  departureAirportIata: nullableString,
  departureAirportIcao: nullableString,
  departureAirportName: nullableString,
  departureTimeZone: nullableString,
  arrivalAirportIata: nullableString,
  arrivalAirportIcao: nullableString,
  arrivalAirportName: nullableString,
  arrivalTimeZone: nullableString,
  scheduledDepartureLocal: z.string().trim().min(1).max(80),
  scheduledDepartureUtc: z.iso.datetime({ offset: true }),
  scheduledArrivalLocal: nullableString,
  scheduledArrivalUtc: z.iso
    .datetime({ offset: true })
    .nullish()
    .transform(value => value ?? undefined),
  revisedDepartureLocal: nullableString,
  revisedArrivalLocal: nullableString,
  departureTerminal: nullableString,
  departureGate: nullableString,
  departureCheckInDesk: nullableString,
  arrivalTerminal: nullableString,
  arrivalGate: nullableString,
  arrivalBaggageBelt: nullableString,
  status: z.string().trim().min(1).max(80),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform(value => value ?? undefined),
  aircraftModel: nullableString,
  aircraftRegistration: nullableString,
  lastUpdatedUtc: z.iso
    .datetime({ offset: true })
    .nullish()
    .transform(value => value ?? undefined),
});

export const flightSelect =
  'id, trip_id, flight_number, airline_name, airline_iata, airline_icao, departure_date, arrival_date, departure_airport_iata, departure_airport_icao, departure_airport_name, departure_time_zone, arrival_airport_iata, arrival_airport_icao, arrival_airport_name, arrival_time_zone, scheduled_departure_local, scheduled_departure_utc, scheduled_arrival_local, scheduled_arrival_utc, revised_departure_local, revised_arrival_local, departure_terminal, departure_gate, departure_check_in_desk, arrival_terminal, arrival_gate, arrival_baggage_belt, status, duration_minutes, aircraft_model, aircraft_registration, last_updated_utc';

type ProviderDateTime = {
  local?: unknown;
  utc?: unknown;
};

type ProviderMovement = {
  airport?: {
    iata?: unknown;
    icao?: unknown;
    name?: unknown;
    timeZone?: unknown;
  };
  scheduledTime?: ProviderDateTime;
  revisedTime?: ProviderDateTime | null;
  terminal?: unknown;
  gate?: unknown;
  checkInDesk?: unknown;
  baggageBelt?: unknown;
};

export type AeroDataBoxFlight = {
  number?: unknown;
  airline?: { name?: unknown; iata?: unknown; icao?: unknown } | null;
  departure?: ProviderMovement;
  arrival?: ProviderMovement;
  status?: unknown;
  aircraft?: { model?: unknown; reg?: unknown } | null;
  lastUpdatedUtc?: unknown;
};

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function localDate(value: unknown) {
  const text = stringValue(value);
  const match = text?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

function localTime(value: unknown) {
  const text = stringValue(value);
  const match = text?.match(/[T ](\d{2}:\d{2})/);
  return match?.[1];
}

function validDateTime(value: unknown) {
  const text = stringValue(value);
  if (!text || Number.isNaN(Date.parse(text))) return undefined;
  return new Date(text).toISOString();
}

function movementLocal(movement: ProviderMovement | undefined) {
  return stringValue(movement?.scheduledTime?.local);
}

function movementUtc(movement: ProviderMovement | undefined) {
  return validDateTime(movement?.scheduledTime?.utc);
}

function revisedLocal(movement: ProviderMovement | undefined) {
  return stringValue(movement?.revisedTime?.local);
}

function durationMinutes(departureUtc: string | undefined, arrivalUtc: string | undefined) {
  if (!departureUtc || !arrivalUtc) return undefined;
  const duration = Math.round((Date.parse(arrivalUtc) - Date.parse(departureUtc)) / 60000);
  return duration > 0 ? duration : undefined;
}

function movementValue(movement: ProviderMovement | undefined, key: keyof ProviderMovement) {
  return stringValue(movement?.[key] as unknown);
}

/** Normalize the current AeroDataBox FlightContract into the app's stable shape. */
export function flightCandidateFromProvider(flight: AeroDataBoxFlight): TripFlightCandidate | null {
  const departureLocal = movementLocal(flight.departure);
  const departureUtc = movementUtc(flight.departure);
  const departureDate =
    localDate(departureLocal) ?? localDate(flight.departure?.scheduledTime?.utc);
  if (!departureDate || !departureLocal || !departureUtc) return null;

  const arrivalLocal = movementLocal(flight.arrival);
  const arrivalUtc = movementUtc(flight.arrival);
  const lastUpdatedUtc = validDateTime(flight.lastUpdatedUtc);
  const parsed = flightCandidateSchema.safeParse({
    flightNumber: stringValue(flight.number) ?? 'Unknown flight',
    airlineName: stringValue(flight.airline?.name),
    airlineIata: stringValue(flight.airline?.iata),
    airlineIcao: stringValue(flight.airline?.icao),
    departureDate,
    arrivalDate: localDate(arrivalLocal),
    departureAirportIata: stringValue(flight.departure?.airport?.iata),
    departureAirportIcao: stringValue(flight.departure?.airport?.icao),
    departureAirportName: stringValue(flight.departure?.airport?.name),
    departureTimeZone: stringValue(flight.departure?.airport?.timeZone),
    arrivalAirportIata: stringValue(flight.arrival?.airport?.iata),
    arrivalAirportIcao: stringValue(flight.arrival?.airport?.icao),
    arrivalAirportName: stringValue(flight.arrival?.airport?.name),
    arrivalTimeZone: stringValue(flight.arrival?.airport?.timeZone),
    scheduledDepartureLocal: departureLocal,
    scheduledDepartureUtc: departureUtc,
    scheduledArrivalLocal: arrivalLocal,
    scheduledArrivalUtc: arrivalUtc,
    revisedDepartureLocal: revisedLocal(flight.departure),
    revisedArrivalLocal: revisedLocal(flight.arrival),
    departureTerminal: movementValue(flight.departure, 'terminal'),
    departureGate: movementValue(flight.departure, 'gate'),
    departureCheckInDesk: movementValue(flight.departure, 'checkInDesk'),
    arrivalTerminal: movementValue(flight.arrival, 'terminal'),
    arrivalGate: movementValue(flight.arrival, 'gate'),
    arrivalBaggageBelt: movementValue(flight.arrival, 'baggageBelt'),
    status: stringValue(flight.status) ?? 'Unknown',
    durationMinutes: durationMinutes(departureUtc, arrivalUtc),
    aircraftModel: stringValue(flight.aircraft?.model),
    aircraftRegistration: stringValue(flight.aircraft?.reg),
    lastUpdatedUtc,
  });

  return parsed.success ? parsed.data : null;
}

export function flightFromDatabase(row: {
  id: string;
  trip_id: string;
  flight_number: string;
  airline_name: string | null;
  airline_iata: string | null;
  airline_icao: string | null;
  departure_date: string;
  arrival_date: string | null;
  departure_airport_iata: string | null;
  departure_airport_icao: string | null;
  departure_airport_name: string | null;
  departure_time_zone: string | null;
  arrival_airport_iata: string | null;
  arrival_airport_icao: string | null;
  arrival_airport_name: string | null;
  arrival_time_zone: string | null;
  scheduled_departure_local: string;
  scheduled_departure_utc: string;
  scheduled_arrival_local: string | null;
  scheduled_arrival_utc: string | null;
  revised_departure_local: string | null;
  revised_arrival_local: string | null;
  departure_terminal: string | null;
  departure_gate: string | null;
  departure_check_in_desk: string | null;
  arrival_terminal: string | null;
  arrival_gate: string | null;
  arrival_baggage_belt: string | null;
  status: string;
  duration_minutes: number | null;
  aircraft_model: string | null;
  aircraft_registration: string | null;
  last_updated_utc: string | null;
}): TripFlight {
  return {
    id: row.id,
    tripId: row.trip_id,
    flightNumber: row.flight_number,
    airlineName: row.airline_name ?? undefined,
    airlineIata: row.airline_iata ?? undefined,
    airlineIcao: row.airline_icao ?? undefined,
    departureDate: row.departure_date,
    arrivalDate: row.arrival_date ?? undefined,
    departureAirportIata: row.departure_airport_iata ?? undefined,
    departureAirportIcao: row.departure_airport_icao ?? undefined,
    departureAirportName: row.departure_airport_name ?? undefined,
    departureTimeZone: row.departure_time_zone ?? undefined,
    arrivalAirportIata: row.arrival_airport_iata ?? undefined,
    arrivalAirportIcao: row.arrival_airport_icao ?? undefined,
    arrivalAirportName: row.arrival_airport_name ?? undefined,
    arrivalTimeZone: row.arrival_time_zone ?? undefined,
    scheduledDepartureLocal: row.scheduled_departure_local,
    scheduledDepartureUtc: row.scheduled_departure_utc,
    scheduledArrivalLocal: row.scheduled_arrival_local ?? undefined,
    scheduledArrivalUtc: row.scheduled_arrival_utc ?? undefined,
    revisedDepartureLocal: row.revised_departure_local ?? undefined,
    revisedArrivalLocal: row.revised_arrival_local ?? undefined,
    departureTerminal: row.departure_terminal ?? undefined,
    departureGate: row.departure_gate ?? undefined,
    departureCheckInDesk: row.departure_check_in_desk ?? undefined,
    arrivalTerminal: row.arrival_terminal ?? undefined,
    arrivalGate: row.arrival_gate ?? undefined,
    arrivalBaggageBelt: row.arrival_baggage_belt ?? undefined,
    status: row.status,
    durationMinutes: row.duration_minutes ?? undefined,
    aircraftModel: row.aircraft_model ?? undefined,
    aircraftRegistration: row.aircraft_registration ?? undefined,
    lastUpdatedUtc: row.last_updated_utc ?? undefined,
  };
}

export function flightTime(value: string | undefined) {
  return localTime(value) ?? '—';
}

export function flightDate(value: string | undefined) {
  return localDate(value) ?? '—';
}
