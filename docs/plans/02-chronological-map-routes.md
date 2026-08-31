# Shared chronological map-route ordering

## Objective and scope

Make every route map connect itinerary stops in the same deterministic order. Timed stops follow their local start time; equal-time and untimed stops use the planner’s manual `sortOrder` so the line never changes unpredictably between web and mobile.

- **Web:** Use the shared ordering for map routes and any timeline-derived route previews.
- **Mobile:** Use the same function for the native day-route map and visual itinerary route data.
- **Out of scope:** Turn-by-turn directions, travel-time optimization, and changing a person’s manually chosen itinerary order.

## Dependencies

This plan requires [Plan 03 — Optional itinerary times](./03-optional-itinerary-times.md), which establishes `null` as the canonical representation of an untimed item. It should be completed after that contract change and before any route-line polish that depends on ordering.

## Shared domain, database, API, and authorization

- Add a pure, exported `orderScheduleItemsForDay(items, date)` helper to `@wayfare/domain` (or a domain-adjacent shared planner module exported by that package). It accepts API-shaped `ScheduleItem` data and has no UI or map dependency.
- Define the stable ordering rule once:
  1. timed items come first, ascending by `startTime`;
  2. items with the same time sort by ascending `sortOrder`;
  3. untimed items follow, ascending by `sortOrder`;
  4. an ID comparison is the final tie-breaker in every group.
- Preserve `sortOrder` as a non-negative, server-owned sequence per trip day. API create/move/reorder operations must return it, and clients must not substitute array position as a tie-breaker.
- No new tables, RLS policies, roles, or endpoints are needed. Existing schedule read/write authorization continues to control which route data a member can see or edit.

## Implementation details

1. Replace duplicated `startTime.localeCompare(...)` sorting in web map/timeline code and mobile `visual-itinerary`/`day-route-map` code with the shared helper. Do not leave a second, subtly different inline comparator.
2. Build the ground route from scheduled saved places in that ordered list, skipping manual activities with no coordinates. A skipped activity does not reset the path: the line connects the remaining mappable itinerary stops in their relative order.
3. Keep location and stay pins available for context, but do not let them arbitrarily interleave with scheduled-place ordering. If a map deliberately includes arrivals or departures as route endpoints, add arrivals before the ordered ground stops and departures after them; render an actual flight as its own dashed airport-to-airport leg.
4. Ensure every map rendering pass, refetch, and client remount receives a copied/sorted array. Never mutate TanStack Query/server data in place.
5. When a drag/reorder operation changes only `sortOrder`, invalidate/refresh the same trip data that powers the map so a tied time updates immediately.

## User behavior and edge cases

- Two 10:00 activities follow their explicit manual order on every device. If legacy data has the same time and order, ID tie-breaking gives a stable result until a user reorders it.
- Untimed activities appear after timed activities in the route and retain their manual order. They are not silently assigned 00:00 or 09:00 solely for display or map sequencing.
- Manual activities without a saved place remain visible in itinerary UI but cannot produce a map coordinate or a route segment.
- A day with zero or one mappable stop has no ground polyline. Flights continue to render independently when both airports are known and route lines are enabled.

## Tests, acceptance criteria, and verification

Automated coverage:

- Add domain tests for chronological ordering, same-time/manual-order ties, untimed/manual-order ties, missing `sortOrder`, and final ID determinism.
- Add web and mobile map tests proving both consume the shared helper and receive the same coordinate sequence for one mixed itinerary.
- Test a reorder mutation/invalidation path so equal-time routes redraw without a full page/app restart.

Acceptance criteria:

- Given the same trip response, web and mobile produce identical ground-route stop IDs.
- Time ties and untimed entries do not reorder between renders.
- Flight legs are not accidentally folded into the ground path.

Run before handoff:

```bash
npm run typecheck
npm test
npm run lint
npm run format:check
npm run build
```

Manually create same-time, untimed, and coordinate-less activities, reorder them, then compare the web and native route maps.
