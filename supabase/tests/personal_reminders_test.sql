begin;

select plan(10);

-- Keep fixtures self-contained; the transaction is rolled back after the RLS
-- checks and only the actual authenticated writes run with constraints enabled.
set local session_replication_role = replica;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-reminders@test.local', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor-reminders@test.local', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer-reminders@test.local', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'removed-reminders@test.local', '', now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unrelated-reminders@test.local', '', now(), '{}', '{}');

insert into public.trips (
  id, owner_id, name, start_date, end_date, default_time_zone, default_currency
)
values (
  '00000000-0000-0000-0000-000000000211',
  '00000000-0000-0000-0000-000000000201',
  'Reminder fixtures',
  '2030-01-01',
  '2030-01-02',
  'UTC',
  'EUR'
);

insert into public.trip_members (trip_id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000201', 'OWNER'),
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000202', 'EDITOR'),
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000203', 'VIEWER'),
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000204', 'VIEWER');

insert into public.saved_places (
  id, trip_id, provider, category, custom_name, custom_latitude, custom_longitude, created_by
)
values (
  '00000000-0000-0000-0000-000000000221',
  '00000000-0000-0000-0000-000000000211',
  'CUSTOM',
  'RESTAURANT',
  'Fixture cafe',
  1,
  1,
  '00000000-0000-0000-0000-000000000201'
);

insert into public.personal_reminders (
  id, trip_id, user_id, source_kind, saved_place_id, source_title_snapshot,
  source_body_snapshot, title, body, remind_at
)
values
  (
    '00000000-0000-0000-0000-000000000231',
    '00000000-0000-0000-0000-000000000211',
    '00000000-0000-0000-0000-000000000201',
    'SAVED_PLACE',
    '00000000-0000-0000-0000-000000000221',
    'Fixture cafe',
    'Call before five',
    'Book a table',
    'Call before five',
    '2030-01-01T10:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000232',
    '00000000-0000-0000-0000-000000000211',
    '00000000-0000-0000-0000-000000000204',
    'SAVED_PLACE',
    '00000000-0000-0000-0000-000000000221',
    'Fixture cafe',
    'Call before five',
    'Removed member reminder',
    'Call before five',
    '2030-01-01T10:00:00Z'
  );

set local session_replication_role = origin;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.personal_reminders'::regclass),
  'personal reminders has row-level security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.personal_reminders', 'select, insert, update, delete'),
  'anonymous clients have no personal-reminder access'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select results_eq(
  'select count(*) from public.personal_reminders',
  array[1::bigint],
  'an owner sees only their own reminder'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select lives_ok(
  $$
    insert into public.personal_reminders (
      trip_id, user_id, source_kind, saved_place_id, source_title_snapshot,
      source_body_snapshot, title, body, remind_at
    ) values (
      '00000000-0000-0000-0000-000000000211',
      '00000000-0000-0000-0000-000000000202',
      'SAVED_PLACE',
      '00000000-0000-0000-0000-000000000221',
      'Fixture cafe',
      'Call before five',
      'Editor reminder',
      'Call before five',
      '2030-01-01T10:00:00Z'
    )
  $$,
  'an editor can create their own personal reminder from a shared source'
);
select results_eq(
  'select count(*) from public.personal_reminders',
  array[1::bigint],
  'an editor cannot enumerate another member’s reminders'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
select lives_ok(
  $$
    insert into public.personal_reminders (
      trip_id, user_id, source_kind, saved_place_id, source_title_snapshot,
      source_body_snapshot, title, body, remind_at
    ) values (
      '00000000-0000-0000-0000-000000000211',
      '00000000-0000-0000-0000-000000000203',
      'SAVED_PLACE',
      '00000000-0000-0000-0000-000000000221',
      'Fixture cafe',
      'Call before five',
      'Viewer reminder',
      'Call before five',
      '2030-01-01T10:00:00Z'
    )
  $$,
  'a viewer can create their own reminder from a readable shared note'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000205', true);
select throws_ok(
  $$
    insert into public.personal_reminders (
      trip_id, user_id, source_kind, saved_place_id, source_title_snapshot,
      source_body_snapshot, title, body, remind_at
    ) values (
      '00000000-0000-0000-0000-000000000211',
      '00000000-0000-0000-0000-000000000205',
      'SAVED_PLACE',
      '00000000-0000-0000-0000-000000000221',
      'Fixture cafe',
      'Call before five',
      'Unrelated reminder',
      'Call before five',
      '2030-01-01T10:00:00Z'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "personal_reminders"',
  'an unrelated user cannot create a reminder for the trip'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select results_eq(
  $$update public.personal_reminders
    set title = 'Not allowed'
    where id = '00000000-0000-0000-0000-000000000231'
    returning 1$$,
  array[]::integer[],
  'a member cannot update another person’s reminder'
);

reset role;
delete from public.trip_members
where trip_id = '00000000-0000-0000-0000-000000000211'
  and user_id = '00000000-0000-0000-0000-000000000204';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000204', true);
select results_eq(
  'select count(*) from public.personal_reminders',
  array[0::bigint],
  'a removed member cannot access their reminder'
);

reset role;
delete from public.saved_places where id = '00000000-0000-0000-0000-000000000221';
select results_eq(
  $$select source_title_snapshot, source_body_snapshot, saved_place_id is null
    from public.personal_reminders
    where id = '00000000-0000-0000-0000-000000000231'$$,
  $$values ('Fixture cafe'::text, 'Call before five'::text, true)$$,
  'deleting a source nulls the link but preserves its reminder snapshot'
);

select * from finish();
rollback;
