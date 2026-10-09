<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Wayfare project guide

## Sources of truth

- This file owns repository-wide architecture, conventions, and verification.
- `apps/web/AGENTS.md` owns web-specific rules. Read it before changing `apps/web`.
- `apps/mobile/AGENTS.md` owns mobile-specific rules. Read it before changing `apps/mobile`.
- `.agents/skills/wayfare-operations/SKILL.md` owns releases and database operations. Use it for requests such as "deploy web", "deploy mobile", "deploy mobile and web", "create new TestFlight", or "update Supabase migration".
- `docs/architecture.md` describes durable runtime boundaries. `docs/decisions/` records lasting architectural choices.
- `docs/plans/` records feature decisions. Treat a plan as historical context unless the current task explicitly adopts it.

## Architecture and ownership

- `apps/web` is the Next.js App Router application, the production web app, and the authenticated HTTP API used by mobile.
- `apps/mobile` is the Expo Router application. It is iPhone-first; Android support exists but Android releases must be requested explicitly.
- `packages/domain` owns shared Zod contracts and domain behavior. Put cross-client request/response types, validation, and pure business rules here instead of duplicating them.
- `packages/map-preferences` owns shared map preference behavior.
- `supabase/migrations` is the forward-only database history. `supabase/tests` contains database assertions.

Keep dependency direction one-way: clients may consume shared packages; shared packages must not import either app. Mobile must call the authenticated web API for trip data and mutations rather than querying application tables directly. The web server is the only place for server credentials and third-party secret keys.

## Project conventions

- Use the pinned `pnpm` version from the root `package.json`, and run workspace commands from the repository root unless a guide says otherwise.
- Preserve the user's existing worktree changes. Do not clean, reset, reformat, or commit unrelated files.
- Reuse shared domain contracts. Do not create separate web and mobile definitions for the same API payload or business rule.
- Validate inputs at trust boundaries with Zod. Enforce authorization on the server and with Supabase RLS; UI visibility is never authorization.
- Keep secrets out of source and logs. Only explicitly public values may use `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.
- Schema/API changes must remain compatible with the currently deployed web app and installed mobile builds. Prefer additive migrations, deploy the compatible server before a client that depends on it, and remove old fields only in a later release.
- Add focused tests with behavior changes. A bug fix should normally include a regression test at the lowest useful layer.

## Change order

For a feature that spans the stack, work in this order when applicable:

1. Add a backward-compatible migration and database tests.
2. Update `packages/domain` contracts and tests.
3. Update web server routes and tests.
4. Update web and mobile clients.
5. Verify each affected workspace and the cross-client compatibility path.

## Verification

Run the smallest relevant checks while iterating, then the complete checks for every affected area before handoff.

- Shared packages: `pnpm --filter @wayfare/domain typecheck && pnpm --filter @wayfare/domain test` and/or the equivalent `@wayfare/map-preferences` commands.
- Web: `pnpm release:check:web`.
- Mobile: `pnpm release:check:mobile`.
- Cross-cutting or release work: `pnpm release:check`.
- Pending database migrations: `pnpm release:check:database`, followed by local reset and pgTAP tests when Docker is available.

If a check cannot run because a required external service or local runtime is unavailable, report that exact gap; do not describe the change as fully verified.
