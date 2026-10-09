---
name: wayfare-operations
description: Build, release, and operate the Wayfare web app, Expo mobile app, TestFlight builds, and Supabase migrations. Use for requests such as deploy web, deploy mobile, deploy both, create a new TestFlight, apply or update migrations, inspect release status, or roll back a Wayfare release.
---

# Wayfare Operations

Operate the existing Wayfare production targets from the repository root. A direct imperative such as "deploy web", "deploy mobile", "deploy mobile and web", "create new TestFlight", or "update Supabase migration" authorizes the named external mutation; do not ask for a redundant confirmation. It does not authorize commits, pushes, unrelated changes, destructive database operations, App Store review, or a public App Store release.

## Route the request

- For web builds, production deploys, status, or rollbacks, read [references/web-release.md](references/web-release.md).
- For mobile builds, EAS, TestFlight, or mobile release status, read [references/mobile-release.md](references/mobile-release.md).
- For creating, validating, or applying a Supabase migration, read [references/supabase-migrations.md](references/supabase-migrations.md).
- For "deploy mobile and web", read both release references. Also read the migration reference when the release contains pending migrations.

"Deploy mobile" means a new iOS production binary submitted to TestFlight. It does not mean an Expo development/preview build, an Android release, or App Store review. "Create new TestFlight" has the same meaning. Android is built or submitted only when explicitly requested.

"Update Supabase migration" means validate and push pending local migrations to the linked Wayfare project. If the user asks to create or edit a migration instead, keep the work local until they separately ask to apply it.

## Shared preflight

1. Work from the repository root and read the root plus target-specific `AGENTS.md` files.
2. Record `git status --short`, the branch, and `git rev-parse HEAD`. Preserve all existing changes. A dirty tree is allowed for an explicitly requested release, but state that the release contains local changes.
3. Identify the exact linked remote before any mutation. Stop on a target mismatch or missing link; never create or relink a production target implicitly.
4. Check current CLI help before using a flag not documented in these references. Prefer a current project-local CLI or the reference's ephemeral invocation over an outdated global CLI.
5. Run the target's quality gate. Do not deploy through a failed gate unless the user explicitly tells you to accept that named failure.
6. Never print `.env` contents, tokens, database passwords, Apple credentials, signed log URLs, or downloaded production environment files.

Authentication or Apple credential prompts may require the user to complete a provider-owned login flow. Ask them to complete the flow; never ask them to paste a secret into chat.

## Combined release order

For a combined release, first determine whether local migrations are pending. If they are part of the release, use this order:

1. Run all relevant repository and database checks.
2. Apply only backward-compatible pending migrations.
3. Deploy and verify the web/API release.
4. Build and submit the mobile release to TestFlight.

This order keeps the API compatible with the newly uploaded mobile binary. Stop after a failed stage and report what already changed; do not hide or automatically roll back a partial release.

## Completion report

Report the source commit and dirty/clean state, checks run, exact targets, deployment/build/submission identifiers and URLs, observed final statuses, and any remaining provider processing. Distinguish "uploaded to TestFlight" from "processed and available to testers" and from "released on the App Store".
