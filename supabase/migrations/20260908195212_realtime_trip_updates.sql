-- Realtime is a freshness signal. The API remains the source of truth.
alter table public.trips add column if not exists revision bigint not null default 0;

create table if not exists private.trip_realtime_outbox (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  revision bigint not null,
  entity text not null check (entity in ('trip', 'days', 'places', 'schedule', 'stays', 'flights', 'locations', 'expenses', 'invitations', 'membership')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts integer not null default 0
);

create index if not exists trip_realtime_outbox_pending_idx
  on private.trip_realtime_outbox (created_at, id) where delivered_at is null;

alter table private.trip_realtime_outbox enable row level security;
revoke all on table private.trip_realtime_outbox from anon, authenticated, public;

create or replace function private.record_trip_change(target_trip_id uuid, target_entity text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  if target_entity not in ('trip', 'days', 'places', 'schedule', 'stays', 'flights', 'locations', 'expenses', 'invitations', 'membership') then
    raise exception 'Invalid trip realtime entity';
  end if;

  update public.trips
  set revision = revision + 1, updated_at = now()
  where id = target_trip_id
  returning revision into next_revision;
  if next_revision is null then raise exception 'Trip not found'; end if;

  insert into private.trip_realtime_outbox (trip_id, revision, entity)
  values (target_trip_id, next_revision, target_entity);
  return next_revision;
end;
$$;

revoke all on function private.record_trip_change(uuid, text) from public, anon, authenticated;

create or replace function private.trip_change_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_trip_id uuid;
begin
  -- record_trip_change updates the parent trip's revision. Do not let that
  -- bookkeeping update re-enter this trigger and create another event.
  if pg_trigger_depth() > 1 then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  target_trip_id := case
    when TG_ARGV[0] = 'trip' then coalesce(new.id, old.id)
    when TG_ARGV[1] = 'trip_id' then coalesce(new.trip_id, old.trip_id)
    when TG_ARGV[1] = 'trip_day_id' then (select trip_id from public.trip_days where id = coalesce(new.trip_day_id, old.trip_day_id))
    else null
  end;
  if target_trip_id is not null then
    perform private.record_trip_change(target_trip_id, TG_ARGV[0]);
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trips_realtime_change on public.trips;
create trigger trips_realtime_change after update on public.trips
for each row when (old is distinct from new) execute function private.trip_change_trigger('trip', 'trip');

drop trigger if exists trip_days_realtime_change on public.trip_days;
create trigger trip_days_realtime_change after insert or update or delete on public.trip_days
for each row execute function private.trip_change_trigger('days', 'trip_id');

drop trigger if exists saved_places_realtime_change on public.saved_places;
create trigger saved_places_realtime_change after insert or update or delete on public.saved_places
for each row execute function private.trip_change_trigger('places', 'trip_id');

drop trigger if exists schedule_items_realtime_change on public.schedule_items;
create trigger schedule_items_realtime_change after insert or update or delete on public.schedule_items
for each row execute function private.trip_change_trigger('schedule', 'trip_day_id');

drop trigger if exists stays_realtime_change on public.stays;
create trigger stays_realtime_change after insert or update or delete on public.stays
for each row execute function private.trip_change_trigger('stays', 'trip_id');

drop trigger if exists trip_members_realtime_change on public.trip_members;
create trigger trip_members_realtime_change after insert or update or delete on public.trip_members
for each row execute function private.trip_change_trigger('membership', 'trip_id');

create or replace function private.realtime_trip_id(topic text)
returns uuid language plpgsql immutable as $$
declare value uuid;
begin
  if topic !~ '^trip:[0-9a-fA-F-]{36}$' then return null; end if;
  value := substring(topic from 6)::uuid;
  return value;
exception when others then return null;
end;
$$;

drop policy if exists "trip members can receive broadcasts" on realtime.messages;
create policy "trip members can receive broadcasts" on realtime.messages
for select to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.is_trip_member(private.realtime_trip_id(realtime.topic()))
);

drop policy if exists "trip members can publish presence" on realtime.messages;
create policy "trip members can publish presence" on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and private.is_trip_member(private.realtime_trip_id(realtime.topic()))
);

-- Delivered rows are intentionally retained only briefly for dispatcher recovery.
create or replace function private.delete_delivered_trip_events()
returns void language sql security definer set search_path = '' as $$
  delete from private.trip_realtime_outbox
  where delivered_at < now() - interval '1 day';
$$;

revoke all on function private.delete_delivered_trip_events() from public, anon, authenticated;
