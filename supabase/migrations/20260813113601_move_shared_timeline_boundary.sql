create or replace function public.move_shared_timeline_boundary(
  left_segment_id uuid,
  right_segment_id uuid,
  stay_id uuid,
  new_boundary date
)
returns setof public.trip_location_segments
language plpgsql
set search_path = public, private
as $$
declare
  left_segment public.trip_location_segments%rowtype;
  right_segment public.trip_location_segments%rowtype;
  target_stay public.stays%rowtype;
  following_stay_start date;
begin
  select * into left_segment
  from public.trip_location_segments
  where id = left_segment_id
  for update;
  select * into right_segment
  from public.trip_location_segments
  where id = right_segment_id
  for update;
  select * into target_stay
  from public.stays
  where id = stay_id
  for update;

  if left_segment.id is null
    or right_segment.id is null
    or target_stay.id is null
    or left_segment.trip_id <> right_segment.trip_id
    or left_segment.trip_id <> target_stay.trip_id
    or left_segment.end_date <> right_segment.start_date
    or target_stay.check_out_date <> left_segment.end_date
    or not private.is_trip_editor(left_segment.trip_id)
  then
    raise exception 'Matching editable location and stay boundaries are required';
  end if;

  if new_boundary <= left_segment.start_date
    or new_boundary >= right_segment.end_date
    or new_boundary <= target_stay.check_in_date
  then
    raise exception 'Boundary must leave at least one night in every item';
  end if;

  select min(check_in_date) into following_stay_start
  from public.stays
  where trip_id = target_stay.trip_id
    and id <> target_stay.id
    and check_in_date >= target_stay.check_out_date;
  if following_stay_start is not null and new_boundary > following_stay_start then
    raise exception 'Stay boundary cannot overlap the following stay';
  end if;

  set constraints trip_location_segments_no_overlap deferred;
  update public.trip_location_segments
  set end_date = new_boundary, updated_at = now()
  where id = left_segment.id;
  update public.trip_location_segments
  set start_date = new_boundary, updated_at = now()
  where id = right_segment.id;
  update public.stays
  set check_out_date = new_boundary, updated_at = now()
  where id = target_stay.id;

  return query
    select *
    from public.trip_location_segments
    where trip_id = left_segment.trip_id
    order by start_date;
end;
$$;

grant execute on function public.move_shared_timeline_boundary(uuid, uuid, uuid, date)
  to authenticated;
