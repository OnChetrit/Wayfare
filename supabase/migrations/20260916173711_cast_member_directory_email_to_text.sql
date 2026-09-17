-- auth.users.email is varchar(255), whereas this RPC's stable public contract
-- declares `email text`. RETURN QUERY needs an exact compatible output shape.
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
    select
      member.user_id,
      member.role,
      member.created_at,
      account.email::text,
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
