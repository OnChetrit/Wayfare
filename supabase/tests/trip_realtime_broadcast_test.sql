begin;

select plan(8);

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
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000402',
  'Realtime broadcast fixture',
  '2030-01-01',
  '2030-01-02',
  'UTC',
  'EUR'
);

set local session_replication_role = origin;

select lives_ok(
  $$select private.record_trip_change('00000000-0000-0000-0000-000000000401', 'schedule')$$,
  'recording a trip change also publishes its freshness signal'
);

select is(
  (select revision from public.trips where id = '00000000-0000-0000-0000-000000000401'),
  1::bigint,
  'the trip revision advances'
);

select is(
  (
    select attempts
    from private.trip_realtime_outbox
    where trip_id = '00000000-0000-0000-0000-000000000401'
  ),
  1,
  'the outbox records one delivery attempt'
);

select ok(
  (
    select delivered_at is not null
    from private.trip_realtime_outbox
    where trip_id = '00000000-0000-0000-0000-000000000401'
  ),
  'the outbox row is marked delivered after broadcast'
);

select is(
  (
    select event
    from realtime.messages
    where topic = 'trip:00000000-0000-0000-0000-000000000401'
    order by inserted_at desc
    limit 1
  ),
  'trip.changed',
  'the event name matches the shared client contract'
);

select is(
  (
    select payload ->> 'type'
    from realtime.messages
    where topic = 'trip:00000000-0000-0000-0000-000000000401'
    order by inserted_at desc
    limit 1
  ),
  'trip.changed',
  'the payload type matches the shared client contract'
);

select is(
  (
    select payload ->> 'entity'
    from realtime.messages
    where topic = 'trip:00000000-0000-0000-0000-000000000401'
    order by inserted_at desc
    limit 1
  ),
  'schedule',
  'the payload identifies the changed trip entity'
);

select ok(
  not has_function_privilege('authenticated', 'private.broadcast_trip_change()', 'execute'),
  'authenticated clients cannot invoke the broadcast trigger function directly'
);

select * from finish();

rollback;
