# Realtime trip updates

## Objective and scope

Keep collaborators’ trip views current without leaking data across trips or overwriting an in-progress edit. Members see a compact connected-user presence indicator and receive private change events that refresh the correct caches; editors receive a clear conflict path rather than a silent stale overwrite.

- **Web:** Subscribe from the client-side trip workspace, refresh current trip UI safely, and show connected members.
- **Mobile:** Subscribe only while an authenticated trip screen is active, invalidate the appropriate TanStack Query data, and show lightweight presence.
- **Out of scope:** Collaborative cursors, live text co-editing, offline mutation replay, or broadcasting full trip rows to clients.

## Dependencies

Requires [Plan 05 — Trip sharing and members](./05-trip-sharing-and-members.md). Realtime channel access must use the finalized owner/editor/viewer membership rules.

## Shared contracts, database, API, and authorization

- Add a small version field to the trip contract, exposed by the trip detail response and mutation responses. Clients send the version they edited via `If-Match` (or an explicitly named `expectedRevision`); a conflict response is `409` with the current revision, never a generic validation error.
- Add a `trips.revision` counter and migration support that advances it for committed trip-affecting changes: trip settings, days, places, schedule, stays, flights, locations, expenses, invitations, and membership. Do not publish row bodies or note/secret-code values as realtime payloads.
- Use private Supabase Realtime channels named `trip:<uuid>`. Realtime authorization policies must permit Broadcast and Presence only when `private.is_trip_member` confirms that the authenticated subscriber is currently a member of the parsed trip ID. No wildcard/public topic policy is acceptable.
- Emit a minimal post-commit event such as `{ type: 'trip.changed', tripId, revision, entity }`. Centralize this through a database trigger/transactional notifier or a single mutation service, rather than relying on each React client to publish after a successful request.
- Wrap mutations in an atomic database-side operation that locks/checks the trip revision, performs the resource write, increments the revision, and emits one event. A router must not merely pre-read a version and then issue an unguarded table update; that is race-prone.

## Implementation details

1. Create a shared `useTripRealtime` integration that subscribes after trip data/auth are ready, tracks presence using only public profile display data, and cleans up on trip switch, sign-out, or screen unmount. Do not expose email, access tokens, reminder data, notes, or booking secret codes in presence/event payloads.
2. Debounce/coalesce bursts of `trip.changed` events per trip. Web refreshes its server-backed workspace data while retaining transient selection/filter state; mobile invalidates the selected trip and summaries with existing query keys. Ignore self-originated events when the corresponding mutation response already updated/invalidate caches, but still accept a newer revision.
3. Do not reset a dirty editor form when an event arrives. Mark it “Trip updated elsewhere” and offer “Reload latest” or “Keep editing”. On save, a stale `If-Match` produces a conflict banner with a deliberate reload/discard path; never overwrite someone else’s value silently.
4. On a successful local mutation, advance the known revision from the response before processing queued events. On reconnect, resubscribe and explicitly refetch once; events are a freshness signal, not the sole source of truth.
5. For membership removal, handle authorization/subscription failure by clearing that trip’s cached data, removing its selection if necessary, and returning the person to their remaining trips. Do not rely on presence alone to communicate revoked access.

## User behavior and edge cases

- A collaborator’s completed change appears shortly after the transaction commits, even if multiple rows changed as part of it. A burst produces one refresh, not a visible reload storm.
- Two people editing unrelated data can continue normally if their version is current. Two stale writes receive a clear conflict rather than last-write-wins data loss.
- Presence is advisory: a disconnect, backgrounded app, or network failure removes/stales the indicator without affecting trip access or data correctness.
- A member may only ever subscribe to their own trip topic. A removed member loses access on refetch/resubscribe even if a stale screen remains mounted.
- If Realtime is unavailable, the planner remains usable with normal request/refetch behavior and an unobtrusive “live updates unavailable” state; it must not loop retries or block edits.

## Tests, acceptance criteria, and verification

Automated coverage:

- Add database tests for revision increments, atomic expected-revision conflicts, event payload minimization, and topic/RLS authorization for each membership role and an unrelated user.
- Unit-test event coalescing, self/newer revision handling, cleanup, presence payload filtering, and conflict-state transitions.
- Add web/mobile integration tests that simulate a remote event while viewing, while a clean editor is open, and while a dirty editor is open; test removal from a trip.

Acceptance criteria:

- Two authorized clients on one trip refresh after a change, while a client on another trip never receives the event.
- Remote changes do not erase unsaved form input, and stale saves return a recoverable conflict.
- Connected-user updates work on web and mobile without leaking email or trip content.

Run before handoff:

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

Manually test two accounts and two devices: clean refresh, concurrent same-item edit, editor-with-dirty-form, sign-out, reconnect, and owner removal of a viewer.
