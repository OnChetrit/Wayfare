<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Wayfare web contributor guide

## Boundaries and structure

- `src/app` owns App Router routes, layouts, route handlers, and route-level loading/error UI.
- Put feature UI and behavior in `src/features/<feature>`, reusable UI in `src/components`, and server/data helpers in `src/lib`.
- Use the `@/` alias for app-local imports and `@wayfare/domain` for shared contracts. React components and their matching SCSS modules use PascalCase filenames; utilities use kebab-case filenames.
- Keep Server Components as the default. Add `"use client"` only at the smallest interactive boundary that needs browser state, effects, or event handlers.
- Before changing Next.js APIs, conventions, configuration, or routing, read the relevant installed guide under `node_modules/next/dist/docs/`; this repository uses Next.js 16 and local docs are authoritative.

## API, auth, and data

- Route handlers that access user data must authenticate through `src/lib/supabase/route-auth.ts`. Preserve both browser cookie sessions and mobile bearer tokens.
- Validate request bodies and external responses with Zod, and return stable JSON shapes and intentional HTTP status codes. Put contracts shared with mobile in `@wayfare/domain`.
- Keep privileged Supabase, Google, AeroDataBox, and storage operations server-only. Never import server helpers into Client Components or expose secret values through `NEXT_PUBLIC_*`.
- Preserve RLS as the database authorization boundary. Service-role access, when genuinely needed, must be narrowly scoped and must repeat the authorization checks that RLS would otherwise provide.
- Server Components should call the data layer directly rather than calling this application's own route handlers. Client Components and mobile use route handlers.

## UI and styling

- Use colocated `*.module.scss` files and existing visual tokens/patterns. Avoid new global styles for feature-specific UI.
- Preserve keyboard operation, visible focus, semantic controls, labels, and reduced-motion behavior.
- Treat desktop and narrow/mobile web layouts as supported surfaces. Check both when changing the trip editor, map, timeline, dialogs, or navigation.

## Environment and build

- `apps/web/next.config.ts` intentionally loads repository-root environment files after app-local files; app-local values take precedence. Do not duplicate secrets into committed config.
- Vercel is linked at the repository root and its project Root Directory is `apps/web`. Release commands must run from the repository root, not from `apps/web`.
- Run `pnpm --filter @wayfare/web lint`, `typecheck`, `test`, and `build` before handoff. A production release additionally follows `.agents/skills/wayfare-operations/references/web-release.md`.
