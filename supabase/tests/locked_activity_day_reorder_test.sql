begin;

select plan(6);

set local session_replication_role = replica;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'locked-reorder@test.local', '', now(), '{}', '{}'
), (
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'locked-reorder-viewer@test.local', '', now(), '{}', '{}'
);

insert into public.trips (
  id, owner_id, name, start_date, end_date, default_time_zone, default_currency
) values (
  '00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000401',
  'Locked reorder fixture', '2030-01-01', '2030-01-02', 'UTC', 'EUR'
);

insert into public.trip_days (id, trip_id, local_date) values
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000411', '2030-01-01'),
  ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000411', '2030-01-02');

insert into public.trip_members (trip_id, user_id, role) values (
  '00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000402',
  'VIEWER'
);

insert into public.schedule_items (
  id, trip_day_id, time_zone, sort_order, title_override, reservation_locked
) values (
  '00000000-0000-0000-0000-000000000414',
  '00000000-0000-0000-0000-000000000412', 'UTC', 0, 'Booked museum', true
);

set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select set_config('request.headers', '{}', true);

select lives_ok(
  $$update public.schedule_items set sort_order = 1 where id = '00000000-0000-0000-0000-000000000414'$$,
  'an editor can reorder a locked activity within its day without confirmation'
);
select is(
  (select sort_order from public.schedule_items where id = '00000000-0000-0000-0000-000000000414'),
  1,
  'the new order is persisted'
);
select is(
  (select mutation_version from public.schedule_items where id = '00000000-0000-0000-0000-000000000414'),
  1,
  'reordering alone does not change the reservation version'
);
select throws_like(
  $$update public.schedule_items set notes = 'Changed', sort_order = 2 where id = '00000000-0000-0000-0000-000000000414'$$,
  '%RESERVATION_CONFIRMATION_REQUIRED%',
  'changing reservation details alongside order still requires confirmation'
);
select throws_like(
  $$update public.schedule_items set trip_day_id = '00000000-0000-0000-0000-000000000413' where id = '00000000-0000-0000-0000-000000000414'$$,
  '%RESERVATION_CONFIRMATION_REQUIRED%',
  'moving a locked activity to another day still requires confirmation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
select is(
  (
    with updated as (
      update public.schedule_items
      set sort_order = 2
      where id = '00000000-0000-0000-0000-000000000414'
      returning id
    )
    select count(*) from updated
  ),
  0::bigint,
  'a viewer still cannot reorder a locked activity'
);

select * from finish();
rollback;
