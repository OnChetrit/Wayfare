# Mobile parity implementation roadmap

This roadmap closes the user-facing gaps found between the web and Expo mobile apps. Each plan is independently verifiable and should be completed in order unless explicitly reprioritized.

## Plan 1 — Trip lifecycle

Implement mobile trip creation, full trip settings, and owner-only deletion. Surface controls in Account and no-trip empty states.

- Extend the shared trip-summary contract with `ownerId`; map it from the existing trips API response so mobile can reliably show deletion only to the owner.
- Add mobile API wrappers for creating and deleting trips; reuse the existing update endpoint for full trip settings.
- Add a root form sheet for creating and editing a trip, including owner-only deletion with a destructive confirmation.
- Default a new trip’s time zone from the device, falling back to `UTC`, and its currency from the user preference, falling back to `EUR`.
- Add trip lifecycle controls in Account and contextual creation actions in no-trip states.
- After changes, invalidate trip-list/detail queries and keep `lastTripId` valid.

Verification: contract/API request tests cover owner mapping plus create/delete behavior; trip-selection tests cover creation, deletion fallback, and clearing an empty selection; manually verify create, edit, owner deletion, and non-owner visibility.

## Plan 2 — Saved places and place details

Bring the mobile saved-place library to parity with the web map workspace.

- Add a Google Maps shared-list import sheet that accepts a public/shared list URL, reports imported and skipped places, and refreshes the map and saved-place drawer.
- Add saved-place deletion with a confirmation, removing affected schedule references as the existing API does.
- Add a place-details sheet for Google results and saved places with rating, photo gallery, attribution links, comments, favorite status, save-to-trip state, and add-to-day actions.
- Add a location-scoped saved-place view and map filter, including assignment/removal of places from a location shortlist.

Verification: unit-test import result handling and place deletion invalidation; component-test destructive confirmation and detail actions; manually verify import deduplication, photos, comments, favorites, and location filtering.

## Plan 3 — Visual itinerary and route map

Add the web planner's cross-day planning affordances in native form.

- Add a multi-day itinerary overview with vertical and horizontal layouts, showing manual activities and flight arrivals/departures together.
- Support moving a scheduled item between dates from the overview and adding a saved place to a selected day without returning to Explore.
- Add a day-route map mode that shows the selected day's locations, stays, scheduled places, and flight airports; render ground and flight route polylines where coordinates are available.
- Add a location timeline editor that supports creating a location over a selected date range and adjusts neighboring location boundaries safely.
- Add direct visual editing of stay date ranges and adjacent location boundaries; retain form-based editing as the accessible fallback.

Verification: test date-range and boundary calculations; component-test move/add flows; manually verify map fitting, route rendering, cross-day moves, and date validation.

## Plan 4 — Activity, stay, and flight details

Complete the missing planning fields and travel context.

- Add optional amount and currency fields to manual itinerary activities and persist them through the schedule API.
- Enhance stay editing with Google hotel search and saved-place linking, city/area, selectable price currency, cancellation time, and access/secret code.
- Present detailed flight information in itinerary and timeline views: airline, route, status, terminal, gate, and arrival baggage belt when supplied by flight search.

Verification: validate optional activity pricing; test stay payload mapping and linked-hotel flow; manually verify a flight with terminal/gate/baggage data and a hotel-linked stay.

## Plan 5 — Expense insights

Turn the mobile expenses tab into an analysis view while retaining the existing CRUD sheet.

- Add totals grouped by currency, per-day spend, and category summaries for flight, hotel, and activities.
- Add category filtering and a compact category breakdown visualization.
- Identify stays, flights, and itinerary items that have no linked expense and provide a path to create one with its source preselected.

Verification: unit-test multi-currency/category aggregations and missing-source detection; component-test filter and prefilled-expense flows; manually verify totals against mixed-currency data.

## Plan 6 — Account preferences and invitations

Add the remaining account controls and web invitation flow to mobile.

- Let a user edit display name and account-level preferred currency through Supabase user metadata.
- Add an appearance preference selector for system, light, and dark themes; apply it across native screens and map styling.
- Add an invite deep-link route that authenticates when necessary, redeems the invitation token, refreshes the trip list, and selects the joined trip.

Verification: test metadata parsing/updating and deep-link token parsing; manually verify theme persistence, sign-in redirect/resume, valid invitation redemption, and invalid/expired invitation errors.

## Plan 7 — Public mobile onboarding

Decide whether the web marketing landing experience requires a native counterpart; if approved, implement it as an unauthenticated onboarding screen.

- Present the product value proposition and core capabilities before sign-in.
- Link directly to login and sign-up without duplicating authenticated planner UI.
- Keep this plan optional: it is a marketing/onboarding parity item rather than a trip-planning dependency.

Verification: manual navigation and accessibility review on small and large devices.

## Shared delivery rules

- Preserve the authenticated Next.js API boundary and bearer-token forwarding; never move server-only Google or flight credentials into the app.
- Reuse `@wayfare/domain` contracts and TanStack Query invalidation patterns for every new mobile mutation.
- Keep writes disabled offline and show actionable reconnection messaging.
- For every plan, run mobile lint, typecheck, tests, and format checks before handoff, then verify the changed flow on an iPhone.
