# Optional itinerary times

## Objective and scope

Allow an itinerary activity to be planned for a day without inventing a start time. Timed activities remain precise; untimed activities are explicitly “Any time”, can be manually ordered, and work in editors, sorting, drag-and-drop, maps, and both platforms’ itinerary views.

- **Web:** Update activity creation/editing, day plan, timeline, drag targets, and schedule mutation handling.
- **Mobile:** Update itinerary sheets/forms, native day and visual itinerary views, and drag/move behavior where available.
- **Out of scope:** Making flight or stay times optional, changing a trip’s default time zone, or estimating activity start times.

## Dependencies

None. Existing activities and their current times must remain intact during rollout.

## Shared contracts, database, API, and authorization

- Change the shared `ScheduleItem.startTime` type and Zod schema from required `string` to `string | null`; `null` is the only API representation of “no time”. Omitted values are accepted only for backwards-compatible create input and normalized to `null` in responses.
- Update schedule create/update input schemas, mobile `ScheduleInput`, and web request validation so `startTime` accepts either `HH:mm` or `null`. Do not use `''`, `00:00`, or a fabricated default as a sentinel.
- `schedule_items.start_at_utc` is the persistence source of a selected time. Add a defensive forward migration that drops any deployed `NOT NULL` constraint if present and preserves the existing nullable column; keep `time_zone` populated with the trip default even when `start_at_utc` is null. Existing non-null UTC values are never rewritten or backfilled.
- In the schedule mapper, return `startTime: null` when `start_at_utc` is null. On writes, convert local date/time to UTC only for a real time and store `start_at_utc: null` otherwise.
- No role change is needed: editors can create/update/move/reorder activities; viewers can read the resulting untimed state. Enforce the same trip/day/place ownership checks for untimed writes as timed writes.

## Implementation details

1. Add an “Add a time” control to web and mobile activity forms. New activities start untimed unless the user chooses a time; clearing an existing time sends `null`. Keep duration required and meaningful for a timed activity, but do not use it to derive a hidden start time for an untimed one.
2. Render `Any time` (or an equivalent unambiguous label) everywhere a start-time badge previously appeared. Avoid blank alignment holes and avoid displaying a timezone for an untimed item.
3. Keep server allocation of the next `sortOrder` for creates. Reorder actions must explicitly update manual order; moving an item to another date preserves its time value and assigns/reconciles target-day order atomically.
4. Make drag-and-drop usable for untimed cards: a drop into another day changes the date, and reordering cards changes `sortOrder`, not `start_at_utc`. Do not force a time selection to drag an item.
5. Centralize day sorting around the rule documented in Plan 02: timed chronological order, ties by manual order, then untimed manual order. Use the same utility in all visual, map, and next-start-time helpers. `nextScheduleStartTime` may still propose a convenience time, but must not make it mandatory.
6. Update route construction to include untimed saved places according to manual order. A manual activity without a saved place remains non-mappable.

## User behavior and edge cases

- A user can create a saved-place or manual activity with no time, later add a time, or clear a time without losing title, note, price, date, or ordering.
- Existing scheduled items retain their displayed local time after migration. Existing rows with a null UTC time are surfaced as untimed rather than failing contract validation.
- Clearing time across a daylight-saving boundary stores no UTC instant, so there is no DST conversion ambiguity. Selecting a time continues to use the trip time-zone conversion and existing validation behavior.
- Untimed items do not sort as midnight, do not appear before a breakfast item by accident, and do not generate reminder times automatically.
- A failed update leaves the form’s selected/cleared state editable and displays the API validation error; it must not restore a made-up default time.

## Tests, acceptance criteria, and verification

Automated coverage:

- Extend domain/API tests for nullable parsing, request validation, mapper round trips, clearing a time, and preservation of existing UTC values.
- Test form validation for timed and untimed manual/saved-place activities, including a price with/without currency.
- Test sorting and drag/move payloads for a mixed timed/untimed day; add a DST conversion test for the timed path.
- Add a migration test/SQL fixture proving it is safe against both nullable and historically non-null deployed schemas and does not modify existing time values.

Acceptance criteria:

- Both clients can create, edit, clear, move, and reorder an untimed activity through the authenticated API.
- Trip detail responses always represent missing time as `null` and no UI displays a fake time.
- Existing trips load unchanged, and schedule order remains deterministic after a refresh.

Run before handoff:

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

Apply the new migration to a representative copy of the schema, then manually verify timed and untimed edits in web and on an iPhone.
