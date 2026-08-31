# Map route-line visibility toggle

## Objective and scope

Give people a simple way to show or hide route overlays without hiding the map pins they use to plan. The preference is local to the device and browser profile; it is deliberately not a trip setting and is not shared with collaborators.

- **Web:** Add an accessible route-lines control in the map workspace and apply it to `GoogleMapCanvas` in both desktop and compact layouts.
- **Mobile:** Add the same control to the native day-route map and retain its value between launches.
- **Out of scope:** Changing itinerary ordering, directions/road routing, or persisting a visual preference in Supabase.

## Dependencies

None. This plan can land independently; it uses the route sequence currently supplied by the planner.

## Shared domain, database, API, and authorization

- Define one client-only `MapRouteLinePreference` (`showRouteLines: boolean`) and one stable storage key, for example `wayfare.map.show-route-lines`. Its default is `true` when no stored value exists or a stored value is invalid.
- Keep the preference out of `@wayfare/domain`, trip responses, database tables, and mutation payloads. It is presentation state, not collaborative trip data.
- Create a small platform adapter rather than letting map components read storage directly: `localStorage` on web with SSR-safe hydration, and the existing Expo secure local storage on mobile. Storage failures must fall back to the in-memory default without blocking the map.
- No API, RLS, or role changes are required. Viewer access remains read-only, but viewers may change their own local map preference.

## Implementation details

1. Extract route visibility from `GoogleMapCanvas` and `TripMap` into an explicit `showRouteLines` input. Always calculate and render markers/fitting bounds from the complete mappable-place set; only suppress polyline overlays.
2. Put an `aria-pressed`/native selected toggle near the map controls, with clear copy such as “Route lines”. Do not hide the control merely because a particular day currently has fewer than two stops; it should retain its persisted value.
3. Treat all connector overlays consistently. When route lines are off, hide both the solid ground itinerary line and dashed flight legs. Location, stay, activity, and airport markers remain visible and map bounds still include them. Turning the toggle back on restores every currently resolvable leg without another data fetch.
4. Preserve current graceful degradation: a missing airport lookup or fewer than two coordinates produces no corresponding line, never an error or a misleading direct route. The toggle must not initiate airport/Places requests.
5. Keep the web implementation safe during server rendering: render from the default first, read browser storage after mount, and avoid a hydration mismatch. On mobile, load the stored value before or alongside map render and update optimistically on tap.

## User behavior and edge cases

- The setting follows the person’s browser/device, not the selected trip. Switching trips retains the setting; clearing site/app storage resets it to visible.
- Hiding lines does not affect itinerary ordering, selected-place highlighting, place filters, map search, or the ability to add a place to a day.
- Flight markers remain visible while their dashed line is hidden, including when only one airport can be resolved. This keeps arrivals/departures discoverable without implying a route.
- A storage exception, malformed stored value, no map key, or an offline airport lookup must leave the planner usable with the default/last in-memory choice.

## Tests, acceptance criteria, and verification

Automated coverage:

- Unit-test preference parsing, defaulting, storage round trips, and storage-failure fallback for both adapters.
- Component-test that toggling passes `showRouteLines` to each map implementation, preserves markers and fit bounds, and hides/restores both ground and flight polylines.
- Add a mobile test for persisted state across a remount and an accessibility test for the selected state/label.

Acceptance criteria:

- A person can hide and restore route lines on web and mobile without losing pins or changing trip data.
- The choice survives a browser reload or native restart and is not visible to another collaborator/device.
- Dashed flight lines follow the same visibility rule as ground lines; airport pins do not.

Run before handoff:

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

Manually verify desktop, narrow web, Expo Go, and an iPhone development build with a day containing activities, a stay, and a flight with two resolved airports.
