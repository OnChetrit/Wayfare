# Location-scoped saved-places library

## Objective and scope

Make the full trip saved-place library useful while a Location is active: people can search and filter every saved place, see a location’s shortlist and map selection, assign/remove shortlist membership, and add a selected place to a day in that Location without leaving the planning context.

- **Web:** Enhance the active Location panel and map/places workspace with clear All places versus shortlist behavior.
- **Mobile:** Provide the same active-Location library/filter/map-selection/add-to-day flow from Explore and itinerary sheets.
- **Out of scope:** Global places shared between trips, automatic geographic assignment, or changing the reusable `SavedPlace`/`ScheduleItem` relationship.

## Dependencies

None. It uses the existing location-shortlist join table and trip APIs; it does not require a data change from an earlier plan.

## Shared contracts, database, API, and authorization

- Retain `SavedPlace.locationSegmentIds` as the response projection of `trip_location_segment_places`. Add/keep a validated location-library response or selector that returns full trip places plus their current memberships; do not clone a place to make it appear in a location.
- The existing `trip_location_segment_places` table is the canonical shortlist. Add only any missing composite indexes/foreign-key consistency checks needed for responsive location and reverse-place queries. The insert must prove that the saved place and location segment belong to the same trip.
- Use the existing assignment endpoint (`/api/trips/[tripId]/location-segments/[segmentId]/places`) for add/remove, with an explicit idempotent result. Add a read endpoint only if the complete trip payload becomes too large; otherwise keep one coherent trip-detail projection rather than creating competing sources of truth.
- Members can read a location library. Only editors may assign or remove shortlist membership or add a place to a day; viewers receive a readable library with disabled explanatory actions. Enforce this through the existing RLS/editor checks and the authenticated Next API boundary used by mobile.

## Implementation details

1. When a Location is selected, display a scoped library header with an explicit switch between “All saved places” and “This location’s shortlist”; preserve the ordinary category/favorite/text filters in both modes. Include counts after filters, not misleading total-only counts.
2. Search across name, subtitle, category, and relevant saved-place comment. Debounce client filtering without discarding the canonical full library; a no-results state should preserve filters and offer a one-tap clear action.
3. Selecting a list item selects/highlights the existing marker on the map and fits/pans only when useful. Map selection must not add/remove shortlist membership accidentally. Place details make the current membership clear and expose an editor-only assign/remove action.
4. In the active Location context, offer “Add to [day]” for a selected place. Default to the currently selected day only if it falls inside that Location’s `[startDate, endDate)` range; otherwise ask the user to choose one of the Location’s valid days. The activity retains the shared saved-place ID and uses the normal schedule create API.
5. Mirror the flow on mobile through feature components, not route files: active-location filter state, searchable drawer/list, marker selection, actions sheet, and existing online-only TanStack mutations. Keep screen reader labels explicit about “assigned to this location” versus “scheduled on this day.”

## User behavior and edge cases

- A place may be shortlisted in zero, one, or many locations and scheduled on many days without duplication. Removing it from one shortlist never deletes the saved place or existing schedule items.
- A newly created/imported place appears in All saved places immediately. It is not silently assigned based on coordinates; assignment is an explicit action.
- A saved place without usable coordinates remains searchable and assignable/addable, but map selection explains that it cannot be shown on the map.
- Changing the active Location resets only the location-scope switch/selection if it no longer applies; it must not erase a person’s trip-wide search/category preference unexpectedly.
- If a Location has no valid days because its dates are being edited, disable Add to day and explain why instead of scheduling outside the segment.

## Tests, acceptance criteria, and verification

Automated coverage:

- Test library filtering/search, membership counts, switching locations, no-result reset, and coordinate-less map behavior.
- Add route/RLS tests for cross-trip assignment rejection, idempotent add/remove, editor permissions, and viewer read-only responses.
- Component-test place-to-map selection and add-to-day date eligibility on web and mobile; test query invalidation after assign/remove/create schedule.

Acceptance criteria:

- A selected Location exposes the whole trip library as well as its shortlist, with search and filters on both platforms.
- Editors can assign/remove a saved place and add it to a valid day without duplicate records; viewers cannot mutate it.
- Map and list selection remain synchronized, and existing schedule entries survive shortlist changes.

Run before handoff:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run format:check
pnpm run build
```

Manually verify a multi-location trip with a place in two shortlists, an unscheduled place, a coordinate-less custom place, and a viewer account.
