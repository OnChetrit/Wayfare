begin;

select plan(4);

-- Set up a minimal historical row without requiring a seeded Auth user. The
-- transaction rolls this back after verifying the forward migration.
set local session_replication_role = replica;

insert into public.trips (
  id,
  owner_id,
  name,
  start_date,
  end_date,
  default_time_zone,
  default_currency
)
values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  'Migration fixture',
  '2026-10-10',
  '2026-10-11',
  'Europe/Madrid',
  'EUR'
);

insert into public.trip_days (id, trip_id, local_date)
values (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000101',
  '2026-10-10'
);

insert into public.schedule_items (
  id,
  trip_day_id,
  start_at_utc,
  time_zone,
  sort_order,
  title_override
)
values (
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000103',
  '2026-10-10T09:30:00Z',
  'Europe/Madrid',
  0,
  'Existing timed activity'
);

set local session_replication_role = origin;

-- Simulate a historically deployed schema, then re-run the forward migration.
alter table public.schedule_items alter column start_at_utc set not null;
\ir ../migrations/20260831110000_allow_untimed_schedule_items.sql

select ok(
  not exists (
    select 1
    from pg_attribute attribute
    join pg_class relation on relation.oid = attribute.attrelid
    join pg_namespace schema on schema.oid = relation.relnamespace
    where schema.nspname = 'public'
      and relation.relname = 'schedule_items'
      and attribute.attname = 'start_at_utc'
      and attribute.attnotnull
      and not attribute.attisdropped
  ),
  'the migration drops a historical NOT NULL constraint'
);

select is(
  (
    select start_at_utc
    from public.schedule_items
    where id = '00000000-0000-0000-0000-000000000104'
  ),
  '2026-10-10T09:30:00Z'::timestamptz,
  'the migration preserves existing UTC values'
);

-- The migration is also safe when the production column is already nullable.
\ir ../migrations/20260831110000_allow_untimed_schedule_items.sql

select lives_ok(
  $$
    insert into public.schedule_items (
      id,
      trip_day_id,
      start_at_utc,
      time_zone,
      title_override
    )
    values (
      '00000000-0000-0000-0000-000000000105',
      '00000000-0000-0000-0000-000000000103',
      null,
      'Europe/Madrid',
      'Any-time activity'
    )
  $$,
  'an untimed activity can be stored with a populated time zone'
);

select is(
  (
    select start_at_utc
    from public.schedule_items
    where id = '00000000-0000-0000-0000-000000000105'
  ),
  null,
  'the persistence representation for an untimed activity is null'
);

select * from finish();

rollback;
