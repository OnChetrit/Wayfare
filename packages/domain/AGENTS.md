# Wayfare shared-domain contributor guide

## Scope

- This package owns portable business rules, Zod contracts, serialized API shapes, and types shared by web and mobile.
- Keep it runtime-neutral: do not import React, React Native, Next.js, Expo, Node-only APIs, browser globals, database clients, or app-local modules.
- Put UI formatting, network calls, persistence, and framework-specific behavior in the consuming app unless the logic is genuinely shared and pure.

## Contracts and compatibility

- Define runtime validation and TypeScript types together. Prefer a Zod schema plus `z.input`/`z.output` inference over handwritten duplicate types.
- Export public contracts from the package entry point. Keep implementation files focused by domain instead of extending `src/index.ts` indefinitely.
- API response changes must remain readable by installed mobile builds and the currently deployed web server. Add fields before requiring them; make new response fields optional when version skew is possible, and remove legacy fields only in a later coordinated release.
- Serialize transport values explicitly: ISO date/datetime strings, three-letter currency codes, integer minor units where precision matters, and `null` only when absence is part of the contract.
- Preserve historical data readability. A catalog entry becoming inactive must not make stored records invalid.
- Update generated currency data through `scripts/refresh-currencies.py`; do not hand-edit `src/currency-catalog.json`.

## Verification

- Add focused Vitest coverage for schema boundaries, compatibility fallbacks, and pure business rules.
- Run `pnpm --filter @wayfare/domain typecheck` and `pnpm --filter @wayfare/domain test` before handoff.
- When a contract changes, also typecheck and test both consuming apps or run `pnpm release:check`.
