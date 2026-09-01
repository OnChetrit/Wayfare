do $$
begin
  create type public.reminder_source_kind as enum ('SAVED_PLACE', 'SCHEDULE_ITEM');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.reminder_status as enum ('OPEN', 'COMPLETED');
exception
  when duplicate_object then null;
end
$$;

create table public.personal_reminders (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_kind public.reminder_source_kind not null,
  saved_place_id uuid references public.saved_places(id) on delete set null,
  schedule_item_id uuid references public.schedule_items(id) on delete set null,
  source_title_snapshot text not null check (char_length(trim(source_title_snapshot)) between 1 and 200),
  source_body_snapshot text not null check (char_length(trim(source_body_snapshot)) between 1 and 5000),
  title text not null check (char_length(trim(title)) between 1 and 200),
  body text not null default '' check (char_length(trim(body)) <= 5000),
  remind_at timestamptz not null,
  status public.reminder_status not null default 'OPEN',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_reminders_source_kind_check check (
    (saved_place_id is null and schedule_item_id is null)
    or (source_kind = 'SAVED_PLACE' and saved_place_id is not null and schedule_item_id is null)
    or (source_kind = 'SCHEDULE_ITEM' and schedule_item_id is not null and saved_place_id is null)
  ),
  constraint personal_reminders_completion_check check (
    (status = 'OPEN' and completed_at is null)
    or (status = 'COMPLETED' and completed_at is not null)
  )
);

create index personal_reminders_open_user_remind_at_idx
  on public.personal_reminders(user_id, remind_at)
  where status = 'OPEN';

create index personal_reminders_trip_saved_place_idx
  on public.personal_reminders(trip_id, saved_place_id)
  where saved_place_id is not null;

create index personal_reminders_trip_schedule_item_idx
  on public.personal_reminders(trip_id, schedule_item_id)
  where schedule_item_id is not null;

-- Keep direct Data API writes from associating a source from a different trip.
-- Snapshot fields themselves are intentionally not updateable by authenticated users.
create or replace function private.validate_personal_reminder_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_trip_id uuid;
begin
  if new.saved_place_id is not null then
    select trip_id into source_trip_id
    from public.saved_places
    where id = new.saved_place_id;
    if source_trip_id is null or source_trip_id <> new.trip_id then
      raise exception 'Saved place reminder source must belong to the reminder trip';
    end if;
  end if;

  if new.schedule_item_id is not null then
    select day.trip_id into source_trip_id
    from public.schedule_items item
    join public.trip_days day on day.id = item.trip_day_id
    where item.id = new.schedule_item_id;
    if source_trip_id is null or source_trip_id <> new.trip_id then
      raise exception 'Schedule reminder source must belong to the reminder trip';
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.trip_id is distinct from old.trip_id
    or new.user_id is distinct from old.user_id
    or new.source_kind is distinct from old.source_kind
    or new.source_title_snapshot is distinct from old.source_title_snapshot
    or new.source_body_snapshot is distinct from old.source_body_snapshot
  ) then
    raise exception 'Reminder source and snapshot fields are immutable';
  end if;

  return new;
end;
$$;

create trigger personal_reminders_validate_source
before insert or update on public.personal_reminders
for each row execute function private.validate_personal_reminder_source();

alter table public.personal_reminders enable row level security;

revoke all on table public.personal_reminders from anon, authenticated;
grant select, insert, delete on table public.personal_reminders to authenticated;
grant update (title, body, remind_at, status, completed_at, updated_at)
  on table public.personal_reminders to authenticated;

create policy "members can read their own personal reminders"
  on public.personal_reminders for select to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.is_trip_member(trip_id))
  );

create policy "members can create their own personal reminders"
  on public.personal_reminders for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select private.is_trip_member(trip_id))
  );

create policy "members can update their own personal reminders"
  on public.personal_reminders for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.is_trip_member(trip_id))
  )
  with check (
    (select auth.uid()) = user_id
    and (select private.is_trip_member(trip_id))
  );

create policy "members can delete their own personal reminders"
  on public.personal_reminders for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.is_trip_member(trip_id))
  );

notify pgrst, 'reload schema';
