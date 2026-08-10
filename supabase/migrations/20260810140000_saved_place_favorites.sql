alter table public.saved_places
  add column is_favorite boolean not null default false;
