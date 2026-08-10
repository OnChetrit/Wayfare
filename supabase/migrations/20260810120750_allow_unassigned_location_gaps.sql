-- Location segments may be deleted to leave dates unassigned. Keep validating
-- that any remaining segments stay within the trip, while allowing gaps.
create or replace function private.validate_trip_location_segments()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_trip_id uuid;
  trip_start date;
  trip_end date;
begin
  target_trip_id := case when tg_op = 'DELETE' then old.trip_id else new.trip_id end;
  select start_date, end_date into trip_start, trip_end
  from public.trips
  where id = target_trip_id;

  if trip_start is null then
    return null;
  end if;

  if exists (
    select 1 from public.trip_location_segments
    where trip_id = target_trip_id
      and (start_date < trip_start or end_date > trip_end)
  ) then
    raise exception 'Location segments must be inside the trip dates';
  end if;
  return null;
end;
$$;
