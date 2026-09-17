# Realtime trip updates

## Objective and boundaries

Keep each authenticated trip workspace fresh for current collaborators without leaking data across trips or overwriting unsaved edits. Realtime is a freshness signal; authenticated APIs remain the source of truth.

- **Web:** Subscribe while the trip editor is open, refresh server-backed data, show lightweight presence, and expose recoverable stale-save conflicts.
- **Mobile:** Subscribe while an authenticated trip screen is active, invalidate selected-trip queries, and show lightweight presence.
- **Out of scope:** Collaborative cursors, live text co-editing, offline mutation replay, full-row event payloads, and cross-trip presence.

## Dependencies and constraints

Requires [Plan 05 — Trip sharing and members](./05-trip-sharing-and-members.md). Reuse its `OWNER`/`EDITOR`/`VIEWER` authorization and `private.is_trip_member` helper. Do not publish notes, reminders, booking secret codes, emails, access tokens, or complete database rows through Realtime.

## Design contract

### Revisions and conflicts

- Add `revision bigint not null default 0` to `public.trips`.
- Expose `revision` in trip-detail/home payloads and return the resulting revision from every trip-affecting mutation.
- Clients send the revision they edited in `If-Match` as a decimal string. Missing headers may remain temporarily compatible, but migrated editor writes must send them.
- A stale or malformed revision returns HTTP `409` with `{ error: 'trip_revision_conflict', currentRevision, tripId }`, never a generic `400`.
- Revision comparison, resource write, increment, and event recording must be atomic under a trip row lock. Never pre-read a revision in a router and issue an unguarded write.

### Event and topic contract

Use one private topic per trip: `trip:<tripId>`. Broadcast only this shape:

```json
{ "type": "trip.changed", "tripId": "uuid", "revision": 12, "entity": "schedule" }
```

`entity` is an allow-list: `trip`, `days`, `places`, `schedule`, `stays`, `flights`, `locations`, `expenses`, `invitations`, `membership`. No row body or user-entered content is allowed.

Prefer a Postgres outbox plus one server-side dispatcher: the mutation transaction increments the revision and inserts one outbox row; the dispatcher publishes after commit and marks it delivered/retryable. If the deployment cannot run a durable dispatcher, document and implement the smallest centralized mutation-service equivalent—never client-side publish calls.

### Realtime authorization

- Enable private channels and add `realtime.messages` policies for only Broadcast and Presence.
- Parse topics strictly as `trip:<uuid>`; reject malformed, wildcard, empty, or cross-trip topics.
- Permit access only when `private.is_trip_member(parsed_trip_id)` is true for `auth.uid()`.
- Do not authorize using user-editable metadata or a client-supplied role.
- Test owner, editor, viewer, unrelated user, malformed topic, and removed-member cases.

## Database and server work

1. Create the migration with `supabase migration new realtime_trip_updates`; do not invent the timestamped filename.
2. Add `trips.revision`, a minimally indexed outbox table, RLS, and retention/deletion for delivered events. Keep the outbox unexposed or deny Data API access.
3. Add a private atomic helper that locks the trip, checks `expected_revision`, increments exactly once, and records the entity. Define no-op behavior explicitly: no state change means no revision/event.
4. Audit and migrate every trip-affecting path: trip settings, days, saved places, schedule, stays, flights, locations, expenses, invitations, and membership. Each must return the new revision.
5. Add shared domain schemas and web/mobile API helpers for revision, `If-Match`, and conflict responses. Map database conflict errors to `409` without leaking trip data.
6. Ensure membership removal causes subsequent API fetch and subscription authorization to fail; clients must clear that trip’s caches and selection.

## Web implementation

1. Add a shared `useTripRealtime` integration scoped to the authenticated trip editor. Subscribe only after auth/trip data exists; clean up on trip switch, sign-out, unmount, and authorization failure.
2. Track only `{ userId, displayName }` presence with a safe fallback. Never include email or sensitive profile metadata.
3. Coalesce events per trip over a short debounce window; ignore older/equal revisions, accept newer revisions, and refetch once after reconnect.
4. Refresh server-backed data while retaining selection, filters, open panels, and scroll state.
5. Track dirty forms. A newer remote revision marks “Trip updated elsewhere” without replacing input; provide “Reload latest” and “Keep editing”.
6. Send the known revision on save. Preserve input on `409` and show a deliberate conflict action; never silently overwrite.
7. Realtime failure shows a non-blocking “Live updates unavailable” state with bounded retries; ordinary fetch/refetch editing remains usable.

## Mobile implementation

1. Put the integration under `features/trips` or `features/realtime`; route files remain navigation/token handoffs.
2. Subscribe only for an authenticated selected trip screen. Clean up on unmount, trip switch, sign-out, and membership authorization failure.
3. Invalidate selected-trip, trip-list/summary, and affected dependent TanStack Query keys once per coalesced event. Update known revision from successful mutation responses before queued events.
4. Refetch once after reconnect and show presence without email, notes, reminders, or booking data.
5. Send `If-Match` on migrated mutations and expose reusable conflict handling in itinerary, trip, place, stay, flight, expense, and settings editors.

## Test matrix

### Database/RLS

- Revision starts at zero and increments exactly once per committed mutation.
- Concurrent current-revision writes serialize; stale writes fail atomically and do not alter data or increment revision.
- Every entity produces the correct allow-listed event; payload contains only type, trip ID, revision, and entity.
- Broadcast/Presence works for all member roles and fails for unrelated, removed, malformed, and cross-trip subscribers.
- Invitations and membership changes increment revision; removal prevents future subscription/API access.

### Unit/API

- Test `If-Match` parsing, missing/invalid values, `409` mapping, event ordering, debounce/coalescing, presence filtering, cleanup, reconnect, and conflict transitions.
- Test every mutation route returns the new revision and forwards expected revision atomically.

### Web/mobile integration

- Clean workspaces refresh; dirty forms retain input and show conflict state.
- Self-originated responses do not duplicate refreshes; newer queued events still apply.
- Switching/unmount/sign-out removes listeners and presence.
- Realtime failure does not block edits; reconnect refetches once.
- Removing a member clears that trip and returns them to remaining trips.

## Acceptance criteria

- Two authorized clients on one trip observe a minimal event and refresh once; another trip receives nothing.
- Concurrent stale writes return recoverable `409` conflicts and cannot lose data.
- Presence contains only approved display data and is unavailable to non-members.
- Reconnect, refresh, and outages preserve correctness through normal authenticated fetches.
- All trip-affecting mutation paths have atomic revision checks and responses.

## Rollout and verification

Implement in this order: database contract/outbox and tests, server mutation adapters, web integration, mobile integration, then manual verification. Before handoff run:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run format:check
pnpm run build
supabase db advisors
supabase migration list --local
```

Manually test two accounts/devices: clean refresh, concurrent same-item edit, dirty editor, sign-out/reconnect, Realtime outage, owner removal of a viewer, and cross-trip isolation.
