# ADR 0001: Mobile data goes through the web API

- Status: accepted
- Date: 2026-10-09
- Supersedes: none

## Context

Wayfare has a Next.js web application and an Expo mobile application backed by Supabase. Trip operations also depend on server-only integrations and need one authorization, validation, and compatibility boundary. Letting mobile query application tables directly would duplicate domain behavior and make secrets, API evolution, auditing, and cross-resource mutations harder to control.

## Decision

Mobile uses Supabase directly only for authentication and secure session persistence. It sends the Supabase access token to authenticated Next.js route handlers, which validate the user and execute trip reads and mutations with a user-scoped Supabase client. Shared request/response contracts live in `@wayfare/domain`.

Server-only third-party credentials and privileged storage operations remain in the web server. Supabase RLS continues to protect application data even when requests pass through that server.

## Consequences

- Web and mobile share one HTTP contract and authorization path.
- Mobile requires a reachable web deployment for trip data and writes.
- Server/API changes must remain backward compatible with installed mobile builds.
- Direct mobile access to application tables is intentionally unsupported.
- Authentication/session calls remain a deliberate exception because the mobile app must obtain and refresh its own user token.
