-- Keep manual activity order server-owned. The lock is scoped to one trip day,
-- so a create or cross-day move obtains its position atomically without
-- serializing schedules for unrelated trips.
create or replace function private.assign_schedule_item_sort_order()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.trip_day_id::text, 0));

    select coalesce(max(sort_order) + 1, 0)
      into new.sort_order
      from public.schedule_items
     where trip_day_id = new.trip_day_id
       and id is distinct from new.id;
  elsif new.trip_day_id is distinct from old.trip_day_id then
    perform pg_advisory_xact_lock(hashtextextended(new.trip_day_id::text, 0));

    select coalesce(max(sort_order) + 1, 0)
      into new.sort_order
      from public.schedule_items
     where trip_day_id = new.trip_day_id
       and id is distinct from new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_schedule_item_sort_order on public.schedule_items;

create trigger assign_schedule_item_sort_order
before insert or update of trip_day_id on public.schedule_items
for each row
execute function private.assign_schedule_item_sort_order();
