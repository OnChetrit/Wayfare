# Itinerary-note summaries and expansion

## Objective and scope

Make the note attached to an itinerary item visible wherever that item appears, while keeping compact views scannable. Every itinerary view shows a summary when one exists and lets a person expand/collapse it; the vertical Timeline presents the full note by default.

- **Web:** Update day plan cards, timeline horizontal/vertical cards, expanded timeline, and any schedule card used in map/day context.
- **Mobile:** Update the daily itinerary, visual itinerary layouts, and itinerary detail cards/sheets.
- **Out of scope:** Editing note text, changing day notes, changing saved-place comments, or adding reminder data. Existing editors remain the place to edit a schedule note.

## Dependencies

None. It consumes the existing `ScheduleItem.note` field and has no additional data prerequisite.

## Shared contracts, database, API, and authorization

- No domain shape change is needed: `ScheduleItem.note` remains an optional string from the existing schedule API. Add one shared presentation helper, such as `noteSummary`, that trims surrounding whitespace, collapses display-only whitespace, and returns a bounded summary without modifying stored text.
- No database migration or endpoint change is required. Schedule note create/update authorization remains editor-only, while members—including viewers—may read note text already permitted by trip RLS.
- Do not put expanded/collapsed state in trip data, a mutation, or collaborative Realtime events. It is per-view transient UI state, keyed by schedule item ID; it may reset on navigation.

## Implementation details

1. Create one reusable note-preview component/presenter for web and one equivalent native primitive so truncation, empty detection, labels, and accessibility behavior do not drift. Show nothing for absent/whitespace-only notes.
2. Compact cards display a two-line (or equivalent bounded) summary followed by an explicit “Show note”/“Hide note” control when there is more content. Preserve newlines and full text on expansion; do not use hover-only tooltips as the sole access path.
3. In the **vertical Timeline**, show the entire non-empty activity note by default, without a collapse requirement. The horizontal Timeline and dense day/map cards use the compact expandable treatment to preserve scanning density.
4. Keep expansion state stable through a local rerender and map selection, but safely discard it when the item disappears after a delete/refetch. Avoid one global boolean that expands every activity.
5. Ensure cards continue to work with the `Any time` presentation from Plan 03 and do not let long notes alter chronological order, drag handles, drop targets, or map route coordinates.

## User behavior and edge cases

- A short note can be shown in full as its summary without a redundant expand button; a long or multi-line note gets a usable control.
- Blank notes, whitespace-only notes, and notes removed during a concurrent refresh do not leave empty separators or inaccessible buttons.
- Note summaries are textual and safe: render as text, never HTML/Markdown, so pasted content cannot execute or change layout unexpectedly.
- Keyboard and screen-reader users can discover the control, learn its expanded state, and associate it with the item’s note through `aria-expanded`/`aria-controls` or native accessibility state.
- Full vertical Timeline notes preserve meaningful line breaks and remain selectable/copyable on mobile.

## Tests, acceptance criteria, and verification

Automated coverage:

- Unit-test summary normalization, boundaries, multiline handling, and empty-note behavior.
- Component-test each view family for summary rendering, expand/collapse state, full vertical Timeline display, accessibility attributes, and cleanup after an item is removed.
- Add a regression test covering timed and untimed activity cards with notes so layout/state remains independent of time display.

Acceptance criteria:

- Every itinerary view makes a non-empty activity note discoverable without forcing users into the editor.
- Dense views remain compact until expanded; the vertical Timeline always shows the full note.
- Notes remain readable and accessible on desktop, narrow web, and native screens.

Run before handoff:

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

Manually verify a short note, a long multiline note, an empty note, a screen-reader/keyboard path on web, and iPhone text selection.
