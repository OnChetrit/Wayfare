begin;

select plan(18);

-- The fixtures are rolled back. Disable triggers only while inserting Auth
-- fixtures, then exercise all invitation and membership writes as users.
set local session_replication_role = replica;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-sharing@test.local', '', now(), '{}', '{"full_name":"Owner"}'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor-sharing@test.local', '', now(), '{}', '{"full_name":"Editor"}'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer-sharing@test.local', '', now(), '{}', '{"full_name":"Viewer"}'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'recipient-sharing@test.local', '', now(), '{}', '{"full_name":"Recipient"}'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unrelated-sharing@test.local', '', now(), '{}', '{"full_name":"Unrelated"}');

insert into public.trips (
  id, owner_id, name, start_date, end_date, default_time_zone, default_currency
)
values (
  '00000000-0000-0000-0000-000000000311',
  '00000000-0000-0000-0000-000000000301',
  'Sharing fixtures',
  '2030-01-01',
  '2030-01-02',
  'UTC',
  'EUR'
);

insert into public.trip_members (trip_id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301', 'OWNER'),
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000302', 'EDITOR'),
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000303', 'VIEWER');

insert into public.trip_invitations (
  id, trip_id, token, role, created_by, max_uses, use_count
)
values (
  '00000000-0000-0000-0000-000000000321',
  '00000000-0000-0000-0000-000000000311',
  'idempotent-invitation-token-1234567890',
  'VIEWER',
  '00000000-0000-0000-0000-000000000301',
  1,
  0
), (
  '00000000-0000-0000-0000-000000000322',
  '00000000-0000-0000-0000-000000000311',
  'expired-invitation-token-123456789012',
  'VIEWER',
  '00000000-0000-0000-0000-000000000301',
  1,
  0
);

update public.trip_invitations
set expires_at = now() - interval '1 minute'
where id = '00000000-0000-0000-0000-000000000322';

set local session_replication_role = origin;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.trip_members'::regclass),
  'trip members has row-level security enabled'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
select results_eq(
  'select can_manage_members from public.trip_access_for_trip(''00000000-0000-0000-0000-000000000311'')',
  array[true],
  'the owner receives member-management access'
);
select lives_ok(
  $$select * from public.trip_members_for_trip('00000000-0000-0000-0000-000000000311')$$,
  'the owner can read the member directory'
);
select lives_ok(
  $$select public.update_trip_member(
    '00000000-0000-0000-0000-000000000311',
    '00000000-0000-0000-0000-000000000302',
    'VIEWER'
  )$$,
  'the owner can change a non-owner role'
);
select is(
  (select role::text from public.trip_members
    where trip_id = '00000000-0000-0000-0000-000000000311'
      and user_id = '00000000-0000-0000-0000-000000000302'),
  'VIEWER',
  'the role update is stored'
);
select lives_ok(
  $$select public.update_trip_member(
    '00000000-0000-0000-0000-000000000311',
    '00000000-0000-0000-0000-000000000302',
    'EDITOR'
  )$$,
  'the owner can restore an editor role'
);
select throws_ok(
  $$select public.update_trip_member(
    '00000000-0000-0000-0000-000000000311',
    '00000000-0000-0000-0000-000000000301',
    'VIEWER'
  )$$,
  'P0001',
  'The trip owner role cannot be changed',
  'the owner cannot demote themself'
);
select throws_ok(
  $$select public.remove_trip_member(
    '00000000-0000-0000-0000-000000000311',
    '00000000-0000-0000-0000-000000000301'
  )$$,
  'P0001',
  'The trip owner cannot be removed',
  'the owner cannot remove themself'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
select throws_ok(
  $$select * from public.trip_members_for_trip('00000000-0000-0000-0000-000000000311')$$,
  'P0001',
  'Only the trip owner can view the member directory',
  'an editor cannot read member email and name data'
);
select throws_ok(
  $$select public.update_trip_member(
    '00000000-0000-0000-0000-000000000311',
    '00000000-0000-0000-0000-000000000303',
    'EDITOR'
  )$$,
  'P0001',
  'Only the trip owner can change member roles',
  'an editor cannot change member roles'
);
select results_eq(
  $$update public.trip_members
    set role = 'VIEWER'
    where trip_id = '00000000-0000-0000-0000-000000000311'
      and user_id = '00000000-0000-0000-0000-000000000303'
    returning 1$$,
  array[]::integer[],
  'direct table access cannot bypass the owner-only role guard'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
select results_eq(
  'select count(*) from public.trip_members',
  array[1::bigint],
  'a member can read only their own membership row'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000305', true);
select results_eq(
  'select count(*) from public.trip_members',
  array[0::bigint],
  'an unrelated user cannot read membership rows'
);
select throws_ok(
  $$select public.redeem_trip_invitation('expired-invitation-token-123456789012')$$,
  'P0001',
  'This invitation has expired',
  'an expired link never grants a new membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
select is(
  public.redeem_trip_invitation('idempotent-invitation-token-1234567890'),
  '00000000-0000-0000-0000-000000000311'::uuid,
  'a valid invitation joins the recipient'
);
select is(
  (select use_count from public.trip_invitations where id = '00000000-0000-0000-0000-000000000321'),
  1,
  'a new membership consumes exactly one invitation use'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
update public.trip_invitations
set revoked_at = now()
where id = '00000000-0000-0000-0000-000000000321';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
select is(
  public.redeem_trip_invitation('idempotent-invitation-token-1234567890'),
  '00000000-0000-0000-0000-000000000311'::uuid,
  'an existing recipient can reopen a revoked link'
);
select is(
  (select use_count from public.trip_invitations where id = '00000000-0000-0000-0000-000000000321'),
  1,
  'idempotent redemption does not consume another use'
);

select * from finish();
rollback;
