import { NextResponse } from 'next/server';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { expenseSelect } from '@/lib/trips/expenses';
import { getTripEditorContext } from '@/lib/trips/flight-auth';
import { flightCandidateSchema, flightSelect } from '@/lib/trips/flights';

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = flightCandidateSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const contextResult = await getTripEditorContext(auth.supabase, auth.user, tripId);
  if ('error' in contextResult)
    return NextResponse.json({ error: contextResult.error }, { status: 403 });
  if (
    result.data.departureDate < contextResult.trip.start_date ||
    result.data.departureDate > contextResult.trip.end_date
  ) {
    return NextResponse.json(
      { error: 'The flight departure date must be inside the trip dates.' },
      { status: 400 },
    );
  }

  const flight = result.data;
  const { data, error } = await auth.supabase
    .from('trip_flights')
    .insert({
      trip_id: tripId,
      created_by: auth.user.id,
      flight_number: flight.flightNumber,
      airline_name: flight.airlineName ?? null,
      airline_iata: flight.airlineIata ?? null,
      airline_icao: flight.airlineIcao ?? null,
      departure_date: flight.departureDate,
      arrival_date: flight.arrivalDate ?? null,
      departure_airport_iata: flight.departureAirportIata ?? null,
      departure_airport_icao: flight.departureAirportIcao ?? null,
      departure_airport_name: flight.departureAirportName ?? null,
      departure_time_zone: flight.departureTimeZone ?? null,
      arrival_airport_iata: flight.arrivalAirportIata ?? null,
      arrival_airport_icao: flight.arrivalAirportIcao ?? null,
      arrival_airport_name: flight.arrivalAirportName ?? null,
      arrival_time_zone: flight.arrivalTimeZone ?? null,
      scheduled_departure_local: flight.scheduledDepartureLocal,
      scheduled_departure_utc: flight.scheduledDepartureUtc,
      scheduled_arrival_local: flight.scheduledArrivalLocal ?? null,
      scheduled_arrival_utc: flight.scheduledArrivalUtc ?? null,
      revised_departure_local: flight.revisedDepartureLocal ?? null,
      revised_arrival_local: flight.revisedArrivalLocal ?? null,
      departure_terminal: flight.departureTerminal ?? null,
      departure_gate: flight.departureGate ?? null,
      departure_check_in_desk: flight.departureCheckInDesk ?? null,
      arrival_terminal: flight.arrivalTerminal ?? null,
      arrival_gate: flight.arrivalGate ?? null,
      arrival_baggage_belt: flight.arrivalBaggageBelt ?? null,
      status: flight.status,
      duration_minutes: flight.durationMinutes ?? null,
      aircraft_model: flight.aircraftModel ?? null,
      aircraft_registration: flight.aircraftRegistration ?? null,
      last_updated_utc: flight.lastUpdatedUtc ?? null,
    })
    .select(flightSelect)
    .single();
  if (error) {
    if (error.code === '23505')
      return NextResponse.json(
        { error: 'That flight is already part of this trip.' },
        { status: 409 },
      );
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: expense } = await auth.supabase
    .from('trip_expenses')
    .select(expenseSelect)
    .eq('flight_id', data.id)
    .maybeSingle();
  return NextResponse.json({ flight: data, expense }, { status: 201 });
}
