-- Manual activities live directly on the day plan and do not need a saved place.
alter table public.schedule_items
  alter column saved_place_id drop not null,
  add column category public.saved_place_category;

alter table public.schedule_items
  add constraint schedule_items_manual_title_check check (
    saved_place_id is not null
    or (
      title_override is not null
      and char_length(trim(title_override)) between 1 and 200
    )
  );
