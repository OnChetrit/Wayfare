# Mobile and TestFlight release

Wayfare mobile is the Expo/EAS project `@on.chetrit/wayfare` with project ID `6dba87c1-0604-49eb-9305-fff3934e1b99` and iOS bundle identifier `com.onchetrit.wayfare`. Run EAS commands from `apps/mobile`.

Use a current EAS CLI through `npm exec --yes --package=eas-cli@latest -- eas`; the repo's pnpm 12 build-script policy currently blocks `pnpm dlx eas-cli@latest`. `apps/mobile/eas.json` uses remote app-version management and auto-increments production build numbers.

## Production environment contract

The EAS `production` environment must define these public build variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_WEB_URL`
- `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY`
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` when Android is requested

Verify names/existence without printing values. `EXPO_PUBLIC_*` values are embedded in the app and must never contain server secrets.

## Local build and verification

For "build mobile" without release language, do not create a store build. Run:

```bash
pnpm release:check:mobile
```

If the request is specifically for a local iOS binary after native dependency or plugin changes, follow `apps/mobile/AGENTS.md` and use the generated native project only for verification; never edit it as a source of truth.

## Deploy mobile / create new TestFlight

1. Run the full local verification gate above.
2. From `apps/mobile`, run `npm exec --yes --package=eas-cli@latest -- eas whoami` and `npm exec --yes --package=eas-cli@latest -- eas project:info`. Require the expected owner/project ID above.
3. Confirm the public Expo config resolves with `pnpm exec expo config --type public --json > /dev/null`.
4. Create and submit one new build with:

   ```bash
   npm exec --yes --package=eas-cli@latest -- eas build --platform ios --profile production --auto-submit --wait
   ```

5. Capture the build ID/URL and submission status. Use `eas build:view <build-id>` plus `eas submit:list --platform ios` or `eas status` when supported by the current CLI.
6. If EAS reports successful submission, state that Apple may still be processing the build. Verify TestFlight availability when the provider exposes it, but do not claim tester availability from upload success alone.

This workflow uploads to TestFlight internal testing; it does not submit the app for App Store review. Do not run a second `eas submit --latest` after `--auto-submit`, because that can duplicate or target the wrong build.

If the first submission needs App Store Connect setup or a credential login, let EAS drive the provider-owned flow. Do not store Apple credentials in the repository or ask the user to paste them.

## Failure handling

- A failed build does not incrementally deploy an app to users. Report the failed build ID and the failing phase/log summary.
- If the build succeeds but submission fails, preserve the successful build ID. On an explicit retry, submit that exact ID with `eas submit --platform ios --id <build-id>` rather than rebuilding.
- Do not clear caches, rotate credentials, or recreate provisioning profiles unless the failure evidence points there.
