# Personal reminders from notes

## Objective and scope

Let each traveler turn a useful saved-place comment or itinerary-item note into a personal reminder without exposing that reminder to collaborators. This plan provides reminder creation and management; delivery channels are intentionally outside this scope.

- **Web:** Add reminder actions beside saved-place comments and itinerary-item notes, plus a personal reminders list with complete, reopen, edit, and delete actions.
- **Mobile:** Add matching actions in place details and itinerary editors/details, with a native personal-reminders view or sheet.
- **Out of scope:** Shared/team reminders, email/push delivery, recurring reminders, and parsing note text as a command language.

## Dependencies

None. This plan establishes the durable reminder data used by later notification work.

## Shared contracts, database, API, and authorization

- Add `Reminder`, `ReminderSourceKind` (`SAVED_PLACE` or `SCHEDULE_ITEM`), status (`OPEN` or `COMPLETED`), and validated create/update schemas to `@wayfare/domain`. A reminder has an ID, `tripId`, owner `userId`, source kind/nullable source IDs, immutable source-title snapshot, editable title/body, `remindAt` (UTC ISO timestamp), status, completion timestamp, and timestamps needed for display/delivery.
- Create `public.personal_reminders`. It references the trip with `ON DELETE CASCADE`, references the creator user, and references a saved place or schedule item with `ON DELETE SET NULL`. Store a source snapshot so deletion of the original place/item does not erase a person’s reminder context. A check constraint permits at most one live source reference and requires the declared source kind to agree with the supplied source at insert/update.
- Index open reminders by `(user_id, remind_at)` and source lookups by `(trip_id, saved_place_id)`/`(trip_id, schedule_item_id)`. The time is an absolute `timestamptz`; clients choose/display it in the relevant trip/device zone but never store a floating local time.
- RLS is personal and membership-aware: a user may select/insert/update/delete only their own reminders for trips they are currently allowed to read. No owner, editor, or other collaborator can enumerate or edit another person’s reminders. Server routes still verify that the requested source belongs to the specified trip before insert.
- Add authenticated API routes under `/api/trips/[tripId]/reminders` for list/create and `/api/trips/[tripId]/reminders/[reminderId]` for update/delete. A response must never include another user’s reminders. Mobile uses these Next.js routes through the existing bearer-token client, not direct table access.

## Implementation details

1. Add “Create reminder” next to a non-empty saved-place comment and itinerary-item note. Pre-fill the reminder title from the place/activity name and body/source snapshot from the current note; let the person edit both and select a future date/time before saving.
2. Add a personal reminders surface scoped to the selected trip, with Open and Completed filters. Show source context, due/overdue state, and an “original note no longer available” label when a deleted source was nulled.
3. A completed reminder remains visible in Completed and can be reopened; deleting it removes it permanently. Editing a reminder must not mutate the underlying shared note, and subsequent edits to the note must not overwrite the reminder’s saved body/snapshot.
4. Reuse TanStack Query invalidation for the selected trip’s reminder key only; do not refetch or mutate collaborative trip data after a personal reminder operation. On web, refresh the personal reminder query/state without exposing it in server-rendered shared trip payloads.
5. Keep reminder creation disabled while offline with the existing actionable reconnection UI. Do not queue a reminder locally because a missed due time has real product consequences.

## User behavior and edge cases

- Notes are the creation context, not a requirement for the reminder’s lifetime. A user can edit the reminder copy after creation, complete it, or keep it after the source item is deleted.
- Empty notes do not show an enabled “from note” action. A user can still create a generic reminder only if the product later adds a separate explicit flow; this plan does not make an empty note appear meaningful.
- Two collaborators can create reminders from the same note, but each sees only their own record. Deleting/removing a collaborator’s trip access makes their reminders inaccessible through RLS.
- `remindAt` must be valid and in the future for creation; allow an edit to a past time only when product policy explicitly permits marking an overdue reminder, otherwise return a clear validation error.
- A source that is moved to a different day remains linked by ID; source labels refresh from current data when available while the captured text remains stable.

## Tests, acceptance criteria, and verification

Automated coverage:

- Add domain validation tests for source-kind consistency, UTC reminder times, status transitions, and source snapshots.
- Add route tests for trip/source ownership, editor/viewer access to shared notes, personal-only reminder reads, and source deletion with `SET NULL` preservation.
- Add component tests for prefilled note data, edit/complete/reopen/delete, empty-note handling, and offline-disabled creation on web and mobile.
- Add RLS integration tests with owner, editor, viewer, removed member, and unrelated user identities.

Acceptance criteria:

- A signed-in trip member can create and manage only their own reminder from either supported note type on both platforms.
- No reminder operation modifies the source note or appears in a collaborator’s UI/API response.
- Deleting a source does not cause an error or silently delete its personal reminder; the reminder remains understandable via its snapshot.

Run before handoff:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run format:check
pnpm run build
```

Manually test two accounts on the same trip, source deletion, loss of membership, completion/reopen, and a device in offline mode.
