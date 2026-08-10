create extension if not exists "pgcrypto";

create schema if not exists private;

create type public.trip_member_role as enum ('OWNER', 'EDITOR', 'VIEWER');
create type public.saved_place_provider as enum ('GOOGLE', 'CUSTOM');
create type public.saved_place_category as enum ('HOTEL', 'RESTAURANT', 'BAR', 'CAFE', 'ATTRACTION', 'SHOPPING', 'TRANSPORT', 'CUSTOM');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  start_date date not null,
  end_date date not null,
  default_time_zone text not null default 'Europe/Madrid',
  default_currency text not null default 'EUR' check (char_length(default_currency) = 3),
  destination_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_valid_dates check (start_date <= end_date)
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.trip_member_role not null default 'VIEWER',
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  local_date date not null,
  title text,
  notes text,
  unique (trip_id, local_date)
);

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  provider public.saved_place_provider not null,
  provider_place_id text,
  provider_place_id_checked_at timestamptz,
  category public.saved_place_category not null default 'CUSTOM',
  custom_name text,
  user_notes text,
  custom_latitude double precision,
  custom_longitude double precision,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, provider, provider_place_id),
  constraint saved_places_provider_id check (provider = 'CUSTOM' or provider_place_id is not null)
);

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days(id) on delete cascade,
  saved_place_id uuid not null references public.saved_places(id) on delete cascade,
  start_at_utc timestamptz,
  time_zone text not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  sort_order integer not null default 0,
  title_override text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stays (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  saved_place_id uuid not null references public.saved_places(id) on delete cascade,
  check_in_date date not null,
  check_out_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  confirmation_number text,
  notes text,
  constraint stays_valid_dates check (check_in_date < check_out_date)
);

create index trip_members_user_idx on public.trip_members(user_id);
create index trip_days_trip_date_idx on public.trip_days(trip_id, local_date);
create index saved_places_trip_idx on public.saved_places(trip_id);
create index schedule_items_day_order_idx on public.schedule_items(trip_day_id, sort_order);
create index stays_trip_dates_idx on public.stays(trip_id, check_in_date, check_out_date);

create or replace function private.is_trip_member(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select exists (
    select 1
    from public.trips t
    left join public.trip_members tm on tm.trip_id = t.id and tm.user_id = auth.uid()
    where t.id = target_trip_id
      and (t.owner_id = auth.uid() or tm.user_id is not null)
  );
$$;

revoke all on function private.is_trip_member(uuid) from public;
grant execute on function private.is_trip_member(uuid) to authenticated;

create or replace function private.is_trip_editor(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select exists (
    select 1
    from public.trips t
    left join public.trip_members tm on tm.trip_id = t.id and tm.user_id = auth.uid()
    where t.id = target_trip_id
      and (t.owner_id = auth.uid() or tm.role in ('OWNER', 'EDITOR'))
  );
$$;

revoke all on function private.is_trip_editor(uuid) from public;
grant execute on function private.is_trip_editor(uuid) to authenticated;

create or replace function private.add_trip_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'OWNER')
  on conflict (trip_id, user_id) do update set role = 'OWNER';
  return new;
end;
$$;

create trigger trips_add_owner_member
after insert on public.trips
for each row execute function private.add_trip_owner_member();

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_days enable row level security;
alter table public.saved_places enable row level security;
alter table public.schedule_items enable row level security;
alter table public.stays enable row level security;

create policy "members can read trips" on public.trips for select to authenticated using (private.is_trip_member(id));
create policy "users can create their own trips" on public.trips for insert to authenticated with check (owner_id = auth.uid());
create policy "owners can update trips" on public.trips for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners can delete trips" on public.trips for delete to authenticated using (owner_id = auth.uid());

create policy "members can read membership" on public.trip_members for select to authenticated using (private.is_trip_member(trip_id));
create policy "owners can manage membership" on public.trip_members for all to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "members can read trip days" on public.trip_days for select to authenticated using (private.is_trip_member(trip_id));
create policy "editors can manage trip days" on public.trip_days for all to authenticated using (private.is_trip_editor(trip_id)) with check (private.is_trip_editor(trip_id));

create policy "members can read saved places" on public.saved_places for select to authenticated using (private.is_trip_member(trip_id));
create policy "editors can manage saved places" on public.saved_places for all to authenticated using (private.is_trip_editor(trip_id)) with check (private.is_trip_editor(trip_id) and created_by = auth.uid());

create policy "members can read schedules" on public.schedule_items for select to authenticated using (private.is_trip_member((select trip_id from public.trip_days where id = trip_day_id)));
create policy "editors can manage schedules" on public.schedule_items for all to authenticated
  using (private.is_trip_editor((select trip_id from public.trip_days where id = trip_day_id)))
  with check (private.is_trip_editor((select trip_id from public.trip_days where id = trip_day_id)));

create policy "members can read stays" on public.stays for select to authenticated using (private.is_trip_member(trip_id));
create policy "editors can manage stays" on public.stays for all to authenticated using (private.is_trip_editor(trip_id)) with check (private.is_trip_editor(trip_id));
