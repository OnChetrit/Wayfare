create table public.trip_location_segment_places (
  location_segment_id uuid not null references public.trip_location_segments(id) on delete cascade,
  saved_place_id uuid not null references public.saved_places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (location_segment_id, saved_place_id)
);

create index trip_location_segment_places_saved_place_idx
  on public.trip_location_segment_places(saved_place_id);

alter table public.trip_location_segment_places enable row level security;

create policy "members can read location place shortlists"
  on public.trip_location_segment_places
  for select
  to authenticated
  using (
    private.is_trip_member(
      (select trip_id from public.trip_location_segments where id = location_segment_id)
    )
  );

create policy "editors can manage location place shortlists"
  on public.trip_location_segment_places
  for all
  to authenticated
  using (
    private.is_trip_editor(
      (select trip_id from public.trip_location_segments where id = location_segment_id)
    )
  )
  with check (
    private.is_trip_editor(
      (select trip_id from public.trip_location_segments where id = location_segment_id)
    )
    and exists (
      select 1
      from public.trip_location_segments location_segment
      join public.saved_places saved_place
        on saved_place.id = trip_location_segment_places.saved_place_id
      where location_segment.id = trip_location_segment_places.location_segment_id
        and location_segment.trip_id = saved_place.trip_id
    )
  );
