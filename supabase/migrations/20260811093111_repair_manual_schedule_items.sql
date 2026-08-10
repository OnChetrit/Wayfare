-- Keep deployed databases compatible with standalone manual activities.
alter table public.schedule_items
  alter column saved_place_id drop not null,
  add column if not exists category public.saved_place_category;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_items_manual_title_check'
      and conrelid = 'public.schedule_items'::regclass
  ) then
    alter table public.schedule_items
      add constraint schedule_items_manual_title_check check (
        saved_place_id is not null
        or (
          title_override is not null
          and char_length(trim(title_override)) between 1 and 200
        )
      );
  end if;
end;
$$;
