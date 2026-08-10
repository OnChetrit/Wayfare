create type public.trip_expense_category as enum (
  'FLIGHT',
  'HOTEL',
  'RESTAURANT',
  'TICKETS',
  'SHOPPING',
  'TRANSPORT',
  'OTHER'
);

create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  category public.trip_expense_category not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  expense_date date not null,
  notes text,
  stay_id uuid references public.stays(id) on delete set null,
  flight_id uuid references public.trip_flights(id) on delete set null,
  schedule_item_id uuid references public.schedule_items(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_expenses_single_source check (
    (case when stay_id is not null then 1 else 0 end) +
    (case when flight_id is not null then 1 else 0 end) +
    (case when schedule_item_id is not null then 1 else 0 end) <= 1
  )
);

create index trip_expenses_trip_date_idx
  on public.trip_expenses(trip_id, expense_date);
create index trip_expenses_stay_idx on public.trip_expenses(stay_id);
create index trip_expenses_flight_idx on public.trip_expenses(flight_id);
create index trip_expenses_schedule_idx on public.trip_expenses(schedule_item_id);

alter table public.trip_expenses enable row level security;

grant select, insert, update, delete on public.trip_expenses to authenticated;

create policy "members can read trip expenses" on public.trip_expenses
  for select to authenticated
  using (private.is_trip_member(trip_id));

create policy "editors can insert trip expenses" on public.trip_expenses
  for insert to authenticated
  with check (private.is_trip_editor(trip_id) and created_by = auth.uid());

create policy "editors can update trip expenses" on public.trip_expenses
  for update to authenticated
  using (private.is_trip_editor(trip_id))
  with check (private.is_trip_editor(trip_id));

create policy "editors can delete trip expenses" on public.trip_expenses
  for delete to authenticated
  using (private.is_trip_editor(trip_id));
