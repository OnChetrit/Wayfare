-- A stay or flight is an itinerary anchor, so it always owns exactly one
-- expense record. The expense is created at zero when no price is known yet.
-- Keeping the relationship in the database means changes from either editor
-- remain synchronized even when clients have stale state.

alter table public.trip_expenses
  drop constraint if exists trip_expenses_stay_id_fkey,
  drop constraint if exists trip_expenses_flight_id_fkey;

alter table public.trip_expenses
  add constraint trip_expenses_stay_id_fkey
    foreign key (stay_id) references public.stays(id) on delete cascade,
  add constraint trip_expenses_flight_id_fkey
    foreign key (flight_id) references public.trip_flights(id) on delete cascade;

-- Preserve the most recently updated record when repairing old duplicate
-- source links before adding the one-to-one constraints.
delete from public.trip_expenses expense
using (
  select id,
    row_number() over (
      partition by stay_id
      order by updated_at desc, created_at desc, id desc
    ) as position
  from public.trip_expenses
  where stay_id is not null
) duplicate
where expense.id = duplicate.id
  and duplicate.position > 1;

-- Existing linked expenses are the canonical source for the matching stay
-- price before the stay trigger begins maintaining that relationship.
update public.stays stay
set
  price = trim(to_char(expense.amount, 'FM999999999999.00')),
  price_amount = expense.amount,
  price_currency = expense.currency,
  updated_at = now()
from public.trip_expenses expense
where expense.stay_id = stay.id
  and (
    stay.price_amount is distinct from expense.amount
    or stay.price_currency is distinct from expense.currency
    or stay.price is distinct from trim(to_char(expense.amount, 'FM999999999999.00'))
  );

delete from public.trip_expenses expense
using (
  select id,
    row_number() over (
      partition by flight_id
      order by updated_at desc, created_at desc, id desc
    ) as position
  from public.trip_expenses
  where flight_id is not null
) duplicate
where expense.id = duplicate.id
  and duplicate.position > 1;

create unique index trip_expenses_one_per_stay_idx
  on public.trip_expenses(stay_id)
  where stay_id is not null;

create unique index trip_expenses_one_per_flight_idx
  on public.trip_expenses(flight_id)
  where flight_id is not null;

create or replace function private.trip_expense_creator(target_trip_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(auth.uid(), (select owner_id from public.trips where id = target_trip_id));
$$;

create or replace function private.sync_stay_expense()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_currency text;
  target_amount numeric(12, 2);
begin
  select default_currency into target_currency
  from public.trips
  where id = new.trip_id;

  target_amount := coalesce(new.price_amount, 0);
  target_currency := coalesce(new.price_currency, target_currency);

  insert into public.trip_expenses (
    trip_id, title, category, amount, currency, expense_date, stay_id, created_by
  ) values (
    new.trip_id,
    new.name,
    'HOTEL',
    target_amount,
    target_currency,
    new.check_in_date,
    new.id,
    private.trip_expense_creator(new.trip_id)
  )
  on conflict (stay_id) where stay_id is not null do update
  set
    title = excluded.title,
    category = excluded.category,
    amount = excluded.amount,
    currency = excluded.currency,
    expense_date = excluded.expense_date,
    updated_at = now();

  return new;
end;
$$;

create or replace function private.sync_flight_expense()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_currency text;
begin
  select default_currency into target_currency
  from public.trips
  where id = new.trip_id;

  insert into public.trip_expenses (
    trip_id, title, category, amount, currency, expense_date, flight_id, created_by
  ) values (
    new.trip_id,
    new.flight_number,
    'FLIGHT',
    0,
    target_currency,
    new.departure_date,
    new.id,
    private.trip_expense_creator(new.trip_id)
  )
  on conflict (flight_id) where flight_id is not null do update
  set
    title = excluded.title,
    category = excluded.category,
    expense_date = excluded.expense_date,
    updated_at = now();

  return new;
end;
$$;

create or replace function private.sync_expense_price_to_stay()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.stay_id is null
    or (new.amount is not distinct from old.amount and new.currency is not distinct from old.currency) then
    return new;
  end if;

  update public.stays
  set
    price = trim(to_char(new.amount, 'FM999999999999.00')),
    price_amount = new.amount,
    price_currency = new.currency,
    updated_at = now()
  where id = new.stay_id
    and (
      price_amount is distinct from new.amount
      or price_currency is distinct from new.currency
      or price is distinct from trim(to_char(new.amount, 'FM999999999999.00'))
    );

  return new;
end;
$$;

drop trigger if exists stays_sync_expense on public.stays;
create trigger stays_sync_expense
after insert or update of name, check_in_date, price_amount, price_currency on public.stays
for each row execute function private.sync_stay_expense();

drop trigger if exists trip_flights_sync_expense on public.trip_flights;
create trigger trip_flights_sync_expense
after insert or update of flight_number, departure_date on public.trip_flights
for each row execute function private.sync_flight_expense();

drop trigger if exists trip_expenses_sync_stay_price on public.trip_expenses;
create trigger trip_expenses_sync_stay_price
after update of amount, currency on public.trip_expenses
for each row execute function private.sync_expense_price_to_stay();

-- Backfill the source records that existed before the synchronization rules.
insert into public.trip_expenses (
  trip_id, title, category, amount, currency, expense_date, stay_id, created_by
)
select
  stay.trip_id,
  stay.name,
  'HOTEL',
  coalesce(stay.price_amount, 0),
  coalesce(stay.price_currency, trip.default_currency),
  stay.check_in_date,
  stay.id,
  private.trip_expense_creator(stay.trip_id)
from public.stays stay
join public.trips trip on trip.id = stay.trip_id
left join public.trip_expenses expense on expense.stay_id = stay.id
where expense.id is null;

insert into public.trip_expenses (
  trip_id, title, category, amount, currency, expense_date, flight_id, created_by
)
select
  flight.trip_id,
  flight.flight_number,
  'FLIGHT',
  0,
  trip.default_currency,
  flight.departure_date,
  flight.id,
  private.trip_expense_creator(flight.trip_id)
from public.trip_flights flight
join public.trips trip on trip.id = flight.trip_id
left join public.trip_expenses expense on expense.flight_id = flight.id
where expense.id is null;

notify pgrst, 'reload schema';
