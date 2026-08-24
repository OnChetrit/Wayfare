create table public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  role public.trip_member_role not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  constraint trip_invitations_collaborator_role check (role in ('EDITOR', 'VIEWER'))
);

create index trip_invitations_trip_idx on public.trip_invitations(trip_id, created_at desc);

alter table public.trip_invitations enable row level security;

create policy "owners can read trip invitations"
  on public.trip_invitations for select to authenticated
  using (exists (select 1 from public.trips where id = trip_id and owner_id = auth.uid()));

create policy "owners can revoke trip invitations"
  on public.trip_invitations for update to authenticated
  using (exists (select 1 from public.trips where id = trip_id and owner_id = auth.uid()))
  with check (exists (select 1 from public.trips where id = trip_id and owner_id = auth.uid()));

create or replace function public.create_trip_invitation(
  target_trip_id uuid,
  target_role public.trip_member_role,
  target_expires_at timestamptz default null,
  target_max_uses integer default null
)
returns public.trip_invitations
language plpgsql
security definer
set search_path = public, private
as $$
declare
  invitation public.trip_invitations;
begin
  if target_role not in ('EDITOR', 'VIEWER') then
    raise exception 'Invitations can grant Editor or Viewer access only';
  end if;
  if not exists (
    select 1 from public.trips where id = target_trip_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the trip owner can create an invitation';
  end if;
  if target_expires_at is not null and target_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future';
  end if;

  insert into public.trip_invitations (trip_id, role, created_by, expires_at, max_uses)
  values (target_trip_id, target_role, auth.uid(), target_expires_at, target_max_uses)
  returning * into invitation;
  return invitation;
end;
$$;

grant execute on function public.create_trip_invitation(uuid, public.trip_member_role, timestamptz, integer)
  to authenticated;

create or replace function public.redeem_trip_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  invitation public.trip_invitations;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  select * into invitation
  from public.trip_invitations
  where token = trim(invitation_token)
  for update;
  if invitation.id is null then
    raise exception 'This invitation is invalid';
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

  if not exists (
    select 1 from public.trip_members
    where trip_id = invitation.trip_id and user_id = auth.uid()
  ) then
    insert into public.trip_members (trip_id, user_id, role)
    values (invitation.trip_id, auth.uid(), invitation.role);
    update public.trip_invitations
    set use_count = use_count + 1
    where id = invitation.id;
  end if;
  return invitation.trip_id;
end;
$$;

grant execute on function public.redeem_trip_invitation(text) to authenticated;

create or replace function public.trip_members_for_trip(target_trip_id uuid)
returns table (user_id uuid, role public.trip_member_role, joined_at timestamptz, email text, name text)
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  if not exists (
    select 1 from public.trips where id = target_trip_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the trip owner can view the member directory';
  end if;
  return query
    select member.user_id, member.role, member.created_at, account.email,
      coalesce(account.raw_user_meta_data ->> 'full_name', account.raw_user_meta_data ->> 'name', split_part(account.email, '@', 1))
    from public.trip_members member
    join auth.users account on account.id = member.user_id
    where member.trip_id = target_trip_id
    order by case member.role when 'OWNER' then 0 when 'EDITOR' then 1 else 2 end, account.email;
end;
$$;

grant execute on function public.trip_members_for_trip(uuid) to authenticated;

create or replace function private.protect_trip_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  owner uuid;
begin
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

drop trigger if exists trip_members_protect_owner on public.trip_members;
create trigger trip_members_protect_owner
before update or delete on public.trip_members
for each row execute function private.protect_trip_owner_membership();

notify pgrst, 'reload schema';
