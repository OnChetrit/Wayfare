-- Trip membership is managed through the owner-only RPCs below. Keep the
-- member directory private: a regular member can read only their own row.
create or replace function private.is_trip_owner(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.trips
    where id = target_trip_id
      and owner_id = (select auth.uid())
  );
$$;

revoke all on function private.is_trip_owner(uuid) from public, anon;
grant execute on function private.is_trip_owner(uuid) to authenticated;

drop policy if exists "members can read membership" on public.trip_members;
drop policy if exists "owners can manage membership" on public.trip_members;

create policy "members can read their own membership"
  on public.trip_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "owners can read membership"
  on public.trip_members for select to authenticated
  using ((select private.is_trip_owner(trip_id)));

create policy "owners can update non-owner membership"
  on public.trip_members for update to authenticated
  using (
    (select private.is_trip_owner(trip_id))
    and user_id <> (select owner_id from public.trips where id = trip_id)
  )
  with check (
    (select private.is_trip_owner(trip_id))
    and user_id <> (select owner_id from public.trips where id = trip_id)
    and role in ('EDITOR', 'VIEWER')
  );

create policy "owners can delete non-owner membership"
  on public.trip_members for delete to authenticated
  using (
    (select private.is_trip_owner(trip_id))
    and user_id <> (select owner_id from public.trips where id = trip_id)
  );

-- Retain the original owner protection, and make membership identities
-- immutable so direct table access cannot move a member between trips.
create or replace function private.protect_trip_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if tg_op = 'UPDATE' and (new.trip_id <> old.trip_id or new.user_id <> old.user_id) then
    raise exception 'A membership cannot be moved to another trip or user';
  end if;

  if tg_op = 'DELETE' then
    select owner_id into owner from public.trips where id = old.trip_id;
  else
    select owner_id into owner from public.trips where id = new.trip_id;
  end if;

  if tg_op = 'DELETE' and old.user_id = owner then
    raise exception 'The trip owner cannot be removed';
  end if;
  if tg_op = 'UPDATE' and old.user_id = owner and new.role <> 'OWNER' then
    raise exception 'The trip owner role cannot be changed';
  end if;
  if tg_op <> 'DELETE' and new.role = 'OWNER' and new.user_id <> owner then
    raise exception 'Only the trip owner can have the owner role';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Existing public RPCs are retained for API compatibility. They are callable
-- only by authenticated users and pin their search path because they run with
-- elevated table privileges.
create or replace function public.create_trip_invitation(
  target_trip_id uuid,
  target_role public.trip_member_role,
  target_expires_at timestamptz default null,
  target_max_uses integer default null
)
returns public.trip_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.trip_invitations;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if target_role not in ('EDITOR', 'VIEWER') then
    raise exception 'Invitations can grant Editor or Viewer access only';
  end if;
  if target_expires_at is not null and target_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future';
  end if;
  if target_max_uses is not null and target_max_uses <= 0 then
    raise exception 'Invitation use limit must be positive';
  end if;
  if not (select private.is_trip_owner(target_trip_id)) then
    raise exception 'Only the trip owner can create an invitation';
  end if;

  insert into public.trip_invitations (trip_id, role, created_by, expires_at, max_uses)
  values (target_trip_id, target_role, (select auth.uid()), target_expires_at, target_max_uses)
  returning * into invitation;
  return invitation;
end;
$$;

-- Locking the invitation serializes competing redemptions. Check existing
-- membership before link state so a previous recipient can reopen an expired
-- or revoked link without consuming another use or losing access.
create or replace function public.redeem_trip_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.trip_invitations;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into invitation
  from public.trip_invitations
  where token = trim(invitation_token)
  for update;

  if invitation.id is null then
    raise exception 'This invitation is invalid';
  end if;

  if exists (
    select 1
    from public.trip_members
    where trip_id = invitation.trip_id and user_id = (select auth.uid())
  ) then
    return invitation.trip_id;
  end if;

  if invitation.revoked_at is not null then
    raise exception 'This invitation has been revoked';
  end if;
  if invitation.expires_at is not null and invitation.expires_at <= now() then
    raise exception 'This invitation has expired';
  end if;
  if invitation.max_uses is not null and invitation.use_count >= invitation.max_uses then
    raise exception 'This invitation has reached its use limit';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (invitation.trip_id, (select auth.uid()), invitation.role)
  on conflict (trip_id, user_id) do nothing;

  if found then
    update public.trip_invitations
    set use_count = use_count + 1
    where id = invitation.id;
  end if;

  return invitation.trip_id;
end;
$$;

create or replace function public.trip_members_for_trip(target_trip_id uuid)
returns table (user_id uuid, role public.trip_member_role, joined_at timestamptz, email text, name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_trip_owner(target_trip_id)) then
    raise exception 'Only the trip owner can view the member directory';
  end if;

  return query
    select member.user_id, member.role, member.created_at, account.email,
      coalesce(
        account.raw_user_meta_data ->> 'full_name',
        account.raw_user_meta_data ->> 'name',
        split_part(account.email, '@', 1)
      )
    from public.trip_members member
    join auth.users account on account.id = member.user_id
    where member.trip_id = target_trip_id
    order by case member.role when 'OWNER' then 0 when 'EDITOR' then 1 else 2 end, account.email;
end;
$$;

create or replace function public.update_trip_member(
  target_trip_id uuid,
  target_user_id uuid,
  target_role public.trip_member_role
)
returns public.trip_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.trip_members;
  owner_id uuid;
begin
  if target_role not in ('EDITOR', 'VIEWER') then
    raise exception 'Members can only be Editor or Viewer';
  end if;
  if not (select private.is_trip_owner(target_trip_id)) then
    raise exception 'Only the trip owner can change member roles';
  end if;

  select owner_id into owner_id from public.trips where id = target_trip_id;
  if owner_id is null then
    raise exception 'Trip not found';
  end if;
  if target_user_id = owner_id then
    raise exception 'The trip owner role cannot be changed';
  end if;

  update public.trip_members
  set role = target_role
  where trip_id = target_trip_id and user_id = target_user_id
  returning * into member;

  if member.user_id is null then
    raise exception 'Trip member not found';
  end if;
  return member;
end;
$$;

create or replace function public.remove_trip_member(target_trip_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if not (select private.is_trip_owner(target_trip_id)) then
    raise exception 'Only the trip owner can remove members';
  end if;

  select owner_id into owner_id from public.trips where id = target_trip_id;
  if owner_id is null then
    raise exception 'Trip not found';
  end if;
  if target_user_id = owner_id then
    raise exception 'The trip owner cannot be removed';
  end if;

  delete from public.trip_members
  where trip_id = target_trip_id and user_id = target_user_id;
  if not found then
    raise exception 'Trip member not found';
  end if;
end;
$$;

create or replace function public.trip_access_for_trip(target_trip_id uuid)
returns table (role public.trip_member_role, can_edit boolean, can_manage_members boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select
    case when trip.owner_id = (select auth.uid()) then 'OWNER'::public.trip_member_role else member.role end,
    case when trip.owner_id = (select auth.uid()) then true else member.role = 'EDITOR' end,
    trip.owner_id = (select auth.uid())
  from public.trips trip
  left join public.trip_members member
    on member.trip_id = trip.id and member.user_id = (select auth.uid())
  where trip.id = target_trip_id
    and (trip.owner_id = (select auth.uid()) or member.user_id is not null);
$$;

revoke all on function public.create_trip_invitation(uuid, public.trip_member_role, timestamptz, integer) from public, anon;
revoke all on function public.redeem_trip_invitation(text) from public, anon;
revoke all on function public.trip_members_for_trip(uuid) from public, anon;
revoke all on function public.update_trip_member(uuid, uuid, public.trip_member_role) from public, anon;
revoke all on function public.remove_trip_member(uuid, uuid) from public, anon;
revoke all on function public.trip_access_for_trip(uuid) from public, anon;

grant execute on function public.create_trip_invitation(uuid, public.trip_member_role, timestamptz, integer) to authenticated;
grant execute on function public.redeem_trip_invitation(text) to authenticated;
grant execute on function public.trip_members_for_trip(uuid) to authenticated;
grant execute on function public.update_trip_member(uuid, uuid, public.trip_member_role) to authenticated;
grant execute on function public.remove_trip_member(uuid, uuid) to authenticated;
grant execute on function public.trip_access_for_trip(uuid) to authenticated;

notify pgrst, 'reload schema';
