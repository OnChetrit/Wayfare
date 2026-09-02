-- Activities can have private reminders even when they do not have a shared note.
alter table public.personal_reminders
  drop constraint if exists personal_reminders_source_body_snapshot_check;

alter table public.personal_reminders
  add constraint personal_reminders_source_body_snapshot_check
  check (char_length(trim(source_body_snapshot)) <= 5000);

notify pgrst, 'reload schema';
