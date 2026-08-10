create extension if not exists btree_gist;

alter table public.stays
  add column name text,
  add column address text,
  add column location_label text,
  add column check_in_time time,
  add column check_out_time time,
  add column updated_at timestamptz not null default now();

update public.stays s
set name = coalesce(nullif(trim(sp.custom_name), ''), 'Accommodation')
from public.saved_places sp
where sp.id = s.saved_place_id;

update public.stays
set name = 'Accommodation'
where name is null;

alter table public.stays
  alter column name set not null,
  alter column saved_place_id drop not null;

alter table public.stays drop constraint if exists stays_saved_place_id_fkey;
alter table public.stays
  add constraint stays_saved_place_id_fkey
  foreign key (saved_place_id) references public.saved_places(id) on delete set null;

alter table public.stays
  add constraint stays_name_valid check (char_length(trim(name)) between 1 and 200);

alter table public.stays
  add constraint stays_no_overlap
  exclude using gist (
    trip_id with =,
    daterange(check_in_date, check_out_date, '[)') with &&
  ) deferrable initially immediate;

create table public.trip_location_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  location_name text not null check (char_length(trim(location_name)) between 1 and 160),
  country text,
  area text,
  latitude double precision,
  longitude double precision,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_location_segments_valid_dates check (start_date < end_date),
  constraint trip_location_segments_coordinates check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint trip_location_segments_no_overlap
    exclude using gist (
      trip_id with =,
      daterange(start_date, end_date, '[)') with &&
    ) deferrable initially immediate
);

create index trip_location_segments_trip_date_idx
  on public.trip_location_segments(trip_id, start_date, end_date);

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

  if trip_start = trip_end then
    if exists (select 1 from public.trip_location_segments where trip_id = target_trip_id) then
      raise exception 'A zero-night trip cannot have location segments';
    end if;
    return null;
  end if;

  if not exists (select 1 from public.trip_location_segments where trip_id = target_trip_id)
    or exists (
      select 1
      from (
        select end_date, lead(start_date) over (order by start_date) as next_start
        from public.trip_location_segments
        where trip_id = target_trip_id
      ) ranges
      where next_start is not null and end_date <> next_start
    )
    or exists (
      select 1 from public.trip_location_segments
      where trip_id = target_trip_id
        and (start_date < trip_start or end_date > trip_end)
    )
    or (select min(start_date) from public.trip_location_segments where trip_id = target_trip_id) <> trip_start
    or (select max(end_date) from public.trip_location_segments where trip_id = target_trip_id) <> trip_end
  then
    raise exception 'Location segments must cover the trip with contiguous nights';
  end if;
  return null;
end;
$$;

create constraint trigger trip_location_segments_contiguous
after insert or update or delete on public.trip_location_segments
deferrable initially deferred
for each row execute function private.validate_trip_location_segments();

alter table public.trip_location_segments enable row level security;

insert into public.trip_location_segments (trip_id, location_name, start_date, end_date)
select id, 'Unassigned', start_date, end_date
from public.trips
where start_date < end_date;

create or replace function private.add_unassigned_location_segment()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.start_date < new.end_date then
    insert into public.trip_location_segments (trip_id, location_name, start_date, end_date)
    values (new.id, 'Unassigned', new.start_date, new.end_date);
  end if;
  return new;
end;
$$;

create trigger trips_add_unassigned_location_segment
after insert on public.trips
for each row execute function private.add_unassigned_location_segment();

create or replace function public.move_trip_location_boundary(
  left_segment_id uuid,
  right_segment_id uuid,
  new_boundary date
)
returns setof public.trip_location_segments
language plpgsql
set search_path = public, private
as $$
declare
  left_segment public.trip_location_segments%rowtype;
  right_segment public.trip_location_segments%rowtype;
begin
  select * into left_segment from public.trip_location_segments where id = left_segment_id for update;
  select * into right_segment from public.trip_location_segments where id = right_segment_id for update;

  if left_segment.id is null or right_segment.id is null
    or left_segment.trip_id <> right_segment.trip_id
    or left_segment.end_date <> right_segment.start_date
    or not private.is_trip_editor(left_segment.trip_id)
  then
    raise exception 'Adjacent editable location segments are required';
  end if;

  if new_boundary <= left_segment.start_date or new_boundary >= right_segment.end_date then
    raise exception 'Boundary must leave at least one night in each segment';
  end if;

  set constraints trip_location_segments_no_overlap deferred;
  update public.trip_location_segments
  set end_date = new_boundary, updated_at = now()
  where id = left_segment.id;
  update public.trip_location_segments
  set start_date = new_boundary, updated_at = now()
  where id = right_segment.id;

  return query
    select * from public.trip_location_segments
    where trip_id = left_segment.trip_id
    order by start_date;
end;
$$;

create or replace function public.split_trip_location_segment(
  source_segment_id uuid,
  split_date date,
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
  source_segment public.trip_location_segments%rowtype;
begin
  select * into source_segment from public.trip_location_segments where id = source_segment_id for update;
  if source_segment.id is null or not private.is_trip_editor(source_segment.trip_id) then
    raise exception 'Editable location segment is required';
  end if;
  if split_date <= source_segment.start_date or split_date >= source_segment.end_date then
    raise exception 'Split must leave at least one night on each side';
  end if;
  if new_location_name is null or char_length(trim(new_location_name)) = 0 then
    raise exception 'A location name is required';
  end if;

  update public.trip_location_segments
  set end_date = split_date, updated_at = now()
  where id = source_segment.id;
  insert into public.trip_location_segments (
    trip_id, location_name, country, area, latitude, longitude, start_date, end_date
  ) values (
    source_segment.trip_id, trim(new_location_name), nullif(trim(new_country), ''),
    nullif(trim(new_area), ''), new_latitude, new_longitude, split_date, source_segment.end_date
  );

  return query
    select * from public.trip_location_segments
    where trip_id = source_segment.trip_id
    order by start_date;
end;
$$;

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

  select * into selected_segment
  from public.trip_location_segments
  where trip_id = target_trip_id
    and start_date = division_start
  order by end_date
  limit 1
  for update;
  if selected_segment.id is null then
    raise exception 'Could not create location division boundary';
  end if;

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

create or replace function public.merge_trip_location_segment(
  segment_id uuid,
  neighbor_segment_id uuid
)
returns setof public.trip_location_segments
language plpgsql
set search_path = public, private
as $$
declare
  segment public.trip_location_segments%rowtype;
  neighbor public.trip_location_segments%rowtype;
  target_trip_id uuid;
begin
  select * into segment from public.trip_location_segments where id = segment_id for update;
  select * into neighbor from public.trip_location_segments where id = neighbor_segment_id for update;
  if segment.id is null or neighbor.id is null
    or segment.trip_id <> neighbor.trip_id
    or not private.is_trip_editor(segment.trip_id)
    or not (neighbor.end_date = segment.start_date or segment.end_date = neighbor.start_date)
  then
    raise exception 'Adjacent editable location segments are required';
  end if;

  target_trip_id := segment.trip_id;
  set constraints trip_location_segments_no_overlap deferred;
  if neighbor.end_date = segment.start_date then
    update public.trip_location_segments
    set end_date = segment.end_date, updated_at = now()
    where id = neighbor.id;
    delete from public.trip_location_segments where id = segment.id;
  else
    update public.trip_location_segments
    set end_date = neighbor.end_date, updated_at = now()
    where id = segment.id;
    delete from public.trip_location_segments where id = neighbor.id;
  end if;

  return query
    select * from public.trip_location_segments
    where trip_id = target_trip_id
    order by start_date;
end;
$$;

grant execute on function public.move_trip_location_boundary(uuid, uuid, date) to authenticated;
grant execute on function public.split_trip_location_segment(uuid, date, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.create_trip_location_division(uuid, date, date, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.merge_trip_location_segment(uuid, uuid) to authenticated;

create policy "members can read location segments" on public.trip_location_segments
  for select to authenticated using (private.is_trip_member(trip_id));
create policy "editors can manage location segments" on public.trip_location_segments
  for all to authenticated using (private.is_trip_editor(trip_id)) with check (private.is_trip_editor(trip_id));
