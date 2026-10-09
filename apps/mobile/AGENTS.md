# Wayfare mobile contributor guide

## Boundaries and structure

- `app/` contains Expo Router route files only: layouts, redirects, modal declarations, and route-parameter handoff. Do not add feature UI, API calls, hooks, or types there.
- Put product code in `src/features/{auth,trips,itinerary,expenses,explore,account}`. Shared native primitives belong in `src/components/ui`, shared API code in `src/api`, formatting/helpers in `src/lib`, and design tokens in `src/theme`.
- Use kebab-case filenames and the `@/` alias. Keep components focused; split a screen when it contains independent form or list behavior.
- Reuse tokenized UI primitives. Avoid `StyleSheet` screen monoliths; prefer readable inline styles and flex layouts.

## Navigation and UI

- Tabs own nested native stacks. Stack headers provide titles and header actions; editors are Expo Router form sheets declared in the root layout.
- Every scroll/list root must account for safe areas with `contentInsetAdjustmentBehavior="automatic"`. Use flex layout and `useWindowDimensions`, not fixed device dimensions.
- Important data and error text is selectable. Interactive controls need an accessibility role, label, and disabled/selected state where applicable.
- Prefer React Native controls, Expo Router, Reanimated, `expo-image`, and native header search APIs. Add haptics for meaningful actions only.
- This app uses Expo SDK 57. Do not add SwiftUI/local native extensions without an explicit SDK-compatibility review. A confirmed native-only requirement must be scaffolded with `create-expo-module`.

## Data, auth, and mutations

- Mobile calls the authenticated Next.js API only. Never access trip tables directly from the app or place server secrets in `EXPO_PUBLIC_*` variables.
- Supabase's publishable key and secure session storage are the sole client-side Supabase integration. Preserve bearer-token forwarding in `src/api/client.ts`.
- Use TanStack Query keys from `src/api/query-keys.ts`, pass abort signals into requests, and invalidate both the selected trip and trip list after a successful mutation.
- The app is online-first. Cached reads may remain visible offline; disable writes while offline and provide an actionable reconnection message. Do not introduce an offline mutation queue without a dedicated product decision.
- Use `@wayfare/domain` types and Zod contracts for API data. Do not duplicate trip, expense, or category unions in mobile features.

## Native configuration and releases

- Continuous Native Generation is the native workflow. `app.config.ts` is the only native configuration source; `ios/` and `android/` are ignored and generated only for prebuild/build verification.
- Start in Expo Go. Use the development client only to validate native Google Maps/config-plugin behavior, Google OAuth/deep links, or a native module absent from Expo Go.
- Keep Maps keys environment-only and platform restricted: iOS key → bundle identifier; Android key → package name and signing certificate. Rotate any exposed key through Google Cloud before release.
- EAS profiles use remote versioning. Before a development, preview, or production build: run `config:check`, `doctor`, lint, typecheck, tests, and verify the intended environment values and deep links.

### Rebuilding a simulator after native changes

- Adding or upgrading a native Expo package, or changing an `app.config.ts` plugin, requires a new native binary. A Metro reload is not enough.
- For the iOS simulator, regenerate the ignored native project and replace the installed app:

  ```bash
  cd apps/mobile
  pnpm exec expo prebuild --clean --platform ios
  pnpm exec expo run:ios --device "iPhone 17 Pro Max"
  ```

- If an error says a native module cannot be found (for example, `ExpoPushTokenManager`), first check whether `ios/Podfile.lock` contains the expected pod. Regenerate with the commands above; do not edit `ios/` directly.

## Verification

- Add unit tests for formatting, validators/contracts, API error parsing, and query-key/invalidation behavior. Add component tests whenever behavior changes in auth redirects, trip selection, editors, confirmations, or map search.
- Run `pnpm --filter @wayfare/mobile run lint`, `pnpm --filter @wayfare/mobile run typecheck`, `pnpm --filter @wayfare/mobile run test`, and `pnpm --filter @wayfare/mobile run format:check` before handoff. For release readiness, use `pnpm release:check:mobile` from the repository root.
