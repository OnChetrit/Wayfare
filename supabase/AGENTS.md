# Wayfare Supabase contributor guide

## Sources and boundaries

- `migrations/` is the committed, forward-only schema history. Create files with `supabase migration new <descriptive_name>`; never invent timestamps or edit a migration already applied to the linked project.
- `tests/` contains pgTAP database tests. Add focused coverage for RLS, permissions, constraints, triggers, and compatibility behavior.
- `seed.sql` is local development/test data applied after migrations. Keep schema changes out of it and never copy production user data into it.
- Use `.agents/skills/wayfare-operations/references/supabase-migrations.md` when validating or applying migrations to the linked project.

## SQL and security conventions

- Schema-qualify application objects (`public`, `private`, `storage`, or `auth`) and use lowercase snake_case names.
- Enable RLS on every table in an exposed schema and add least-privilege policies for every supported operation. Remember that `UPDATE` also requires a matching `SELECT` policy.
- Keep privileged implementation functions in `private`. Prefer `security invoker`; when `security definer` is required, set a safe search path (normally `set search_path = ''`), schema-qualify every referenced object, revoke default execution, and grant only the intended wrapper or roles.
- Views in exposed schemas must use `security_invoker = true` when supported or be explicitly inaccessible to client roles.
- Authorization must use trusted ownership/membership data or `auth.uid()`, never user-editable metadata.
- Storage replacement requires appropriate `INSERT`, `SELECT`, and `UPDATE` policies; deletion needs its own policy.
- Keep migrations compatible with the currently deployed server and installed mobile clients. Prefer additive changes and stage destructive removals into a later release.

## Migration workflow

1. Inspect linked history with `supabase migration list --linked`.
2. Create a migration through the CLI and write the smallest forward change.
3. Review locks, data rewrites, irreversible statements, grants, RLS, function search paths, and old-client compatibility.
4. Add or update pgTAP tests using the existing `begin`, `plan`, `finish`, and `rollback` pattern.
5. With Docker available, run `supabase start`, `supabase db reset --local`, and `supabase test db`.
6. Before a remote update, run `supabase db push --linked --dry-run` and follow the Wayfare operations skill.

Never use `db reset --linked`, `migration repair`, `migration squash --linked`, or `db push --include-all` during ordinary development or release work.
