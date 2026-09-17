-- Do not use a polymorphic `record` for trigger rows. PL/pgSQL resolves a
-- record field against the trigger table before evaluating a CASE branch, so
-- `record.id` fails for tables such as trip_members that have no id column.
create or replace function private.trip_change_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_trip_id uuid;
  target_trip_day_id uuid;
begin
  -- record_trip_change updates the parent trip's revision. Do not let that
  -- bookkeeping update re-enter this trigger and create another event.
  if pg_trigger_depth() > 1 then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  if TG_ARGV[0] = 'trip' then
    if TG_OP = 'DELETE' then
      target_trip_id := old.id;
    else
      target_trip_id := new.id;
    end if;
  elsif TG_ARGV[1] = 'trip_id' then
    if TG_OP = 'DELETE' then
      target_trip_id := old.trip_id;
    else
      target_trip_id := new.trip_id;
    end if;
  elsif TG_ARGV[1] = 'trip_day_id' then
    if TG_OP = 'DELETE' then
      target_trip_day_id := old.trip_day_id;
    else
      target_trip_day_id := new.trip_day_id;
    end if;

    select trip_id into target_trip_id
    from public.trip_days
    where id = target_trip_day_id;
  end if;

  if target_trip_id is not null then
    perform private.record_trip_change(target_trip_id, TG_ARGV[0]);
  end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
