-- Keep trip date edits atomic with the dependent location timeline. Segments
-- that fall outside the new range are clipped or removed; scheduled items and
-- stays are protected with explicit validation below.
create or replace function public.update_trip_settings(
  target_trip_id uuid,
  trip_name text,
  trip_destination_label text,
  trip_start_date date,
  trip_end_date date,
  trip_time_zone text,
  trip_currency text
)
returns void
language plpgsql
set search_path = public, private
as $$
declare
  target_trip public.trips%rowtype;
begin
  select * into target_trip
  from public.trips
  where id = target_trip_id;

  if target_trip.id is null then
    raise exception 'Trip not found';
  end if;
  if target_trip.owner_id <> auth.uid() then
    raise exception 'Only the trip owner can change trip settings.';
  end if;
  if trip_name is null or char_length(trim(trip_name)) = 0 then
    raise exception 'A trip name is required';
  end if;
  if trip_start_date > trip_end_date then
    raise exception 'Your return date needs to be after your start date.';
  end if;

  if exists (
    select 1
    from public.schedule_items si
    join public.trip_days td on td.id = si.trip_day_id
    where td.trip_id = target_trip_id
      and (td.local_date < trip_start_date or td.local_date > trip_end_date)
  ) then
    raise exception 'Move or remove scheduled activities that fall outside the new trip dates first.';
  end if;

  if exists (
    select 1
    from public.stays
    where trip_id = target_trip_id
      and (check_in_date < trip_start_date or check_out_date > trip_end_date)
  ) then
    raise exception 'Move or remove stays that fall outside the new trip dates first.';
  end if;

  set constraints trip_location_segments_no_overlap deferred;

  if trip_start_date = trip_end_date then
    delete from public.trip_location_segments
    where trip_id = target_trip_id;
  else
    delete from public.trip_location_segments
    where trip_id = target_trip_id
      and (end_date <= trip_start_date or start_date >= trip_end_date);

    update public.trip_location_segments
    set start_date = greatest(start_date, trip_start_date),
        end_date = least(end_date, trip_end_date),
        updated_at = now()
    where trip_id = target_trip_id
      and start_date < trip_end_date
      and end_date > trip_start_date;
  end if;

  update public.trips
  set name = trim(trip_name),
      destination_label = nullif(trim(trip_destination_label), ''),
      start_date = trip_start_date,
      end_date = trip_end_date,
      default_time_zone = trim(trip_time_zone),
      default_currency = upper(trim(trip_currency)),
      updated_at = now()
  where id = target_trip_id;

  delete from public.trip_days
  where trip_id = target_trip_id
    and (local_date < trip_start_date or local_date > trip_end_date);

  insert into public.trip_days (trip_id, local_date)
  select target_trip_id, dates.local_date::date
  from generate_series(trip_start_date, trip_end_date, interval '1 day') as dates(local_date)
  where not exists (
    select 1
    from public.trip_days td
    where td.trip_id = target_trip_id
      and td.local_date = dates.local_date::date
  );
end;
$$;

grant execute on function public.update_trip_settings(
  uuid, text, text, date, date, text, text
) to authenticated;
