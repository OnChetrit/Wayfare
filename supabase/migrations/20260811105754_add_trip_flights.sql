-- Flights are trip-owned records returned by the aviation provider. They are
-- deliberately separate from schedule_items so the day plan can render them
-- as read-only itinerary anchors.
create table public.trip_flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  flight_number text not null check (char_length(trim(flight_number)) between 2 and 20),
  airline_name text,
  airline_iata text,
  airline_icao text,
  departure_date date not null,
  arrival_date date,
  departure_airport_iata text,
  departure_airport_icao text,
  departure_airport_name text,
  departure_time_zone text,
  arrival_airport_iata text,
  arrival_airport_icao text,
  arrival_airport_name text,
  arrival_time_zone text,
  scheduled_departure_local text not null,
  scheduled_departure_utc timestamptz not null,
  scheduled_arrival_local text,
  scheduled_arrival_utc timestamptz,
  revised_departure_local text,
  revised_arrival_local text,
  departure_terminal text,
  departure_gate text,
  departure_check_in_desk text,
  arrival_terminal text,
  arrival_gate text,
  arrival_baggage_belt text,
  status text not null default 'Unknown',
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  aircraft_model text,
  aircraft_registration text,
  last_updated_utc timestamptz,
  provider text not null default 'AERODATABOX',
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, flight_number, departure_date, scheduled_departure_utc)
);

create index trip_flights_trip_date_idx
  on public.trip_flights(trip_id, departure_date, scheduled_departure_utc);

alter table public.trip_flights enable row level security;

grant select, insert, update, delete on public.trip_flights to authenticated;

create policy "members can read trip flights" on public.trip_flights
  for select to authenticated
  using (private.is_trip_member(trip_id));

create policy "editors can manage trip flights" on public.trip_flights
  for all to authenticated
  using (private.is_trip_editor(trip_id))
  with check (private.is_trip_editor(trip_id));

-- Keep a flight's departure date inside the trip when the trip dates change.
-- The check runs before the trip update and the whole settings change remains
-- atomic if any saved flight would fall outside the new range.
create or replace function private.validate_trip_flight_dates()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if exists (
    select 1
    from public.trip_flights
    where trip_id = new.id
      and (departure_date < new.start_date or departure_date > new.end_date)
  ) then
    raise exception 'Move or remove flights that fall outside the new trip dates first.';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_validate_flight_dates on public.trips;
create trigger trips_validate_flight_dates
before update of start_date, end_date on public.trips
for each row execute function private.validate_trip_flight_dates();
