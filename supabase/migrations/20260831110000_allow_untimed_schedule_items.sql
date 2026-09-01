-- An untimed itinerary activity has no UTC instant. This is deliberately a
-- forward-only metadata change: existing timestamps are never rewritten.
do $$
begin
  if exists (
    select 1
    from pg_attribute attribute
    join pg_class relation on relation.oid = attribute.attrelid
    join pg_namespace schema on schema.oid = relation.relnamespace
    where schema.nspname = 'public'
      and relation.relname = 'schedule_items'
      and attribute.attname = 'start_at_utc'
      and attribute.attnotnull
      and not attribute.attisdropped
  ) then
    alter table public.schedule_items alter column start_at_utc drop not null;
  end if;
end
$$;
