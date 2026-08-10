-- Allow a location division to be created inside an unassigned gap.
-- This is also the path used when the user applies a location to one night.
create or replace function public.create_trip_location_division(
  target_trip_id uuid,
  division_start date,
  division_end date,
  new_location_name text,
  new_country text default null,
  new_area text default null,
  new_latitude double precision default null,
  new_longitude double precision default null
)
returns setof public.trip_location_segments
language plpgsql
set search_path = public, private
as $$
declare
  trip public.trips%rowtype;
  start_segment public.trip_location_segments%rowtype;
  end_segment public.trip_location_segments%rowtype;
  selected_segment public.trip_location_segments%rowtype;
  covered_segment public.trip_location_segments%rowtype;
begin
  select * into trip from public.trips where id = target_trip_id;
  if trip.id is null or not private.is_trip_editor(target_trip_id) then
    raise exception 'Editable trip is required';
  end if;
  if division_start >= division_end
    or division_start < trip.start_date
    or division_end > trip.end_date
  then
    raise exception 'Location division must be inside the trip dates';
  end if;
  if new_location_name is null or char_length(trim(new_location_name)) = 0 then
    raise exception 'A location name is required';
  end if;

  set constraints trip_location_segments_no_overlap deferred;

  -- Split the segment containing the first selected night, if one exists.
  -- When the night is in a gap there is nothing to split; a new segment is
  -- inserted below instead.
  select * into start_segment
  from public.trip_location_segments
  where trip_id = target_trip_id
    and start_date < division_start
    and end_date > division_start
  order by start_date
  limit 1
  for update;
  if start_segment.id is not null then
    update public.trip_location_segments
    set end_date = division_start, updated_at = now()
    where id = start_segment.id;
    insert into public.trip_location_segments (
      trip_id, location_name, country, area, latitude, longitude, start_date, end_date
    ) values (
      target_trip_id, start_segment.location_name, start_segment.country, start_segment.area,
      start_segment.latitude, start_segment.longitude, division_start, start_segment.end_date
    );
  end if;

  -- Split the segment containing the first date after the selected range.
  select * into end_segment
  from public.trip_location_segments
  where trip_id = target_trip_id
    and start_date < division_end
    and end_date > division_end
  order by start_date
  limit 1
  for update;
  if end_segment.id is not null then
    update public.trip_location_segments
    set end_date = division_end, updated_at = now()
    where id = end_segment.id;
    insert into public.trip_location_segments (
      trip_id, location_name, country, area, latitude, longitude, start_date, end_date
    ) values (
      target_trip_id, end_segment.location_name, end_segment.country, end_segment.area,
      end_segment.latitude, end_segment.longitude, division_end, end_segment.end_date
    );
  end if;

  -- Reuse the segment created by the first split when possible. If the
  -- selected night was unassigned, create the selected range from scratch.
  select * into selected_segment
  from public.trip_location_segments
  where trip_id = target_trip_id
    and start_date = division_start
  order by end_date
  limit 1
  for update;
  if selected_segment.id is null then
    insert into public.trip_location_segments (
      trip_id, location_name, country, area, latitude, longitude, start_date, end_date
    ) values (
      target_trip_id, trim(new_location_name), nullif(trim(new_country), ''),
      nullif(trim(new_area), ''), new_latitude, new_longitude, division_start, division_end
    )
    returning * into selected_segment;
  end if;

  -- Remove any existing segments fully covered by the selected range.
  for covered_segment in
    select * from public.trip_location_segments
    where trip_id = target_trip_id
      and start_date >= division_start
      and end_date <= division_end
      and id <> selected_segment.id
    order by start_date
  loop
    delete from public.trip_location_segments where id = covered_segment.id;
  end loop;

  update public.trip_location_segments
  set location_name = trim(new_location_name),
      country = nullif(trim(new_country), ''),
      area = nullif(trim(new_area), ''),
      latitude = new_latitude,
      longitude = new_longitude,
      start_date = division_start,
      end_date = division_end,
      updated_at = now()
  where id = selected_segment.id;

  return query
    select * from public.trip_location_segments
    where trip_id = target_trip_id
    order by start_date;
end;
$$;
