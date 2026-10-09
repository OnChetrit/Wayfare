# Supabase migrations

The repository is linked to the active Supabase project named `Wayfare`. Migration history lives in `supabase/migrations`; database tests live in `supabase/tests`. Use the installed Supabase CLI after checking `supabase --version` and the relevant `--help` output.

## Invariants

- Create migration files with `supabase migration new <descriptive_name>`; never invent timestamped filenames.
- Never edit a migration already present in linked remote history. Add a new forward migration instead.
- Keep changes compatible with the deployed web app and installed mobile clients. Prefer additive columns/functions and staged constraint tightening/removal.
- Enable RLS and add least-privilege policies for every new table in an exposed schema. Keep `security definer` functions in an unexposed/private schema, pin a safe `search_path`, and grant execution deliberately.
- Add a focused SQL test for RLS, authorization, constraints, triggers, or compatibility behavior when those change.
- Never run `supabase db reset --linked`, `migration repair`, `migration squash --linked`, or `db push --include-all` as part of a normal update.

## Create or edit a migration

1. Inspect `supabase migration list --linked` before editing so applied history is known.
2. Create a new file with `supabase migration new <descriptive_name>`.
3. Write idempotent SQL only where rerun safety is actually required; normal migrations are applied once.
4. Review for destructive statements, table locks, data rewrites, RLS gaps, unsafe function privileges/search paths, and compatibility with old clients.
5. Add or update database tests.

Creating/editing is local work. Do not push unless the user also asks to update/apply/deploy the migration.

## Validate pending migrations

1. Run `pnpm release:check:database`; it lists linked migration history and performs a remote push dry run without applying changes.
2. Verify the output names only the expected pending versions.
3. When Docker is available, run the local stack and rebuild it from migration history with `supabase start` followed by `supabase db reset --local`, then run `supabase test db`.
4. Run the app/package tests affected by the schema or contract change.

If Docker is unavailable, do not substitute a remote reset. Report that clean-replay/database tests remain unverified and rely only on the dry run plus relevant static/application checks.

## Update/apply Supabase migration

The exact phrase "update Supabase migration" authorizes applying the pending migrations after the validation above.

1. Confirm the linked project resolves to the active project named `Wayfare`.
2. Stop for specific approval if review finds `DROP`, `TRUNCATE`, broad `DELETE`/`UPDATE`, irreversible type changes, large table rewrites, policy removal, or another material data-loss/availability risk. The generic phrase does not authorize those destructive effects.
3. Run `supabase db push --linked --yes`.
4. Run `supabase migration list --linked` again and require local/remote history to match.
5. Run a focused read-only or application-level smoke test that exercises the changed behavior when credentials and tooling allow it.

If there are no pending migrations, make no mutation and report that the linked project is already up to date. If the remote connection times out, retry once after checking CLI/network status; do not loop or relink the project.
