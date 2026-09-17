-- A trigger row has only OLD on DELETE and only NEW on INSERT. Referencing
-- the missing pseudo-record raises e.g. "record new has no field id", even
-- when it appears inside COALESCE.
create or replace function private.trip_change_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_trip_id uuid;
  source_record record;
begin
  -- record_trip_change updates the parent trip's revision. Do not let that
  -- bookkeeping update re-enter this trigger and create another event.
  if pg_trigger_depth() > 1 then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    source_record := old;
  else
    source_record := new;
  end if;

  target_trip_id := case
    when TG_ARGV[0] = 'trip' then source_record.id
    when TG_ARGV[1] = 'trip_id' then source_record.trip_id
    when TG_ARGV[1] = 'trip_day_id' then (
      select trip_id from public.trip_days where id = source_record.trip_day_id
    )
    else null
  end;

  if target_trip_id is not null then
    perform private.record_trip_change(target_trip_id, TG_ARGV[0]);
  end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
