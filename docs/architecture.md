# Wayfare architecture

This document describes the durable system boundaries. Feature-level decisions belong in `docs/plans/`; lasting tradeoffs belong in `docs/decisions/`.

## Runtime map

```mermaid
flowchart LR
  Web[Next.js web client] --> Next[Next.js server and route handlers]
  Mobile[Expo mobile app] -->|Supabase bearer token| Next
  Next -->|user-scoped client + RLS| Database[(Supabase Postgres)]
  Next --> Storage[Supabase Storage]
  Next --> Google[Google Maps and Places]
  Next --> Flights[AeroDataBox]
  Web -. shared contracts .-> Domain[@wayfare/domain]
  Mobile -. shared contracts .-> Domain
  Web -. shared preferences .-> MapPrefs[@wayfare/map-preferences]
  Mobile -. shared preferences .-> MapPrefs
```

## Repository boundaries

| Area                       | Responsibility                                            | Must not contain                                   |
| -------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `apps/web`                 | Web UI, authenticated HTTP API, server integrations       | Mobile UI or public exposure of server credentials |
| `apps/mobile`              | Native UI, device integrations, cached online-first reads | Direct application-table access or server secrets  |
| `packages/domain`          | Portable contracts and business rules                     | Framework, network, or persistence dependencies    |
| `packages/map-preferences` | Portable map preference behavior                          | App-specific storage or UI                         |
| `supabase`                 | Schema history, RLS, database tests, local seed           | Production data or client-only authorization       |

Dependencies flow from the apps toward shared packages, never from shared packages back into an app.

## Authentication and authorization

- Browser requests use Supabase cookie sessions. Mobile requests send the Supabase access token as a bearer token to the same Next.js route handlers.
- Route handlers validate the token and construct a user-scoped Supabase client. RLS remains the database authorization boundary.
- The mobile client uses Supabase directly only for authentication/session management; trip data and mutations go through the Next.js API.
- Service-role access is server-only, narrowly scoped, and must reproduce the authorization guarantees that bypassed RLS would otherwise provide.

## Contracts and version skew

`@wayfare/domain` is the shared wire-contract source of truth. A production web deploy can happen immediately, while a mobile binary can remain installed for months, so schema and API evolution must tolerate mixed versions:

1. Add storage and API behavior compatibly.
2. Deploy the server that accepts old and new clients.
3. Release clients that use the new behavior.
4. Remove compatibility paths only in a later release after old clients are no longer supported.

## Environments and releases

- Local web configuration comes from repository `.env.local`, with variable names documented in `.env.example`.
- Mobile local configuration lives in `apps/mobile/.env`; EAS production values live in the EAS `production` environment.
- Web production is the linked Vercel project whose Root Directory is `apps/web`.
- Mobile production means an iOS EAS production build submitted to TestFlight. App Store review is a separate explicit operation.
- Supabase migrations are applied before dependent web/mobile releases only when they are backward compatible.

Use `.agents/skills/wayfare-operations/SKILL.md` for the executable release procedures.
