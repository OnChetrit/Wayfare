# Web release

Wayfare web is the Vercel project named `wayfare`. The Vercel link lives at the repository root and the configured project Root Directory is `apps/web`; run all Vercel commands from the repository root.

## Production environment contract

The production project must provide these application variables without exposing their values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
- `GOOGLE_MAPS_SERVER_API_KEY`
- `AERODATABOX_API_KEY`
- Optional: `AERODATABOX_API_HOST`, `NEXT_PUBLIC_APP_URL`

Do not pull, print, or overwrite production values merely to deploy. Inspect names or existence only when diagnosing a missing-variable failure.

## Build only

For "build web", run from the repository root:

```bash
pnpm release:check:web
```

This creates a local production build and does not deploy it.

## Deploy web

1. Run the build-only gate above.
2. Use `vercel` when a current CLI is installed; otherwise prefix each command with `npm exec --yes --package=vercel@latest --` (for example, `npm exec --yes --package=vercel@latest -- vercel project inspect --non-interactive`).
3. Run `vercel project inspect --non-interactive` from the repository root. Confirm project `wayfare` and Root Directory `apps/web`. Stop rather than linking if either differs or no project is resolved.
4. Run `vercel deploy --prod` from the repository root and capture the deployment URL from stdout.
5. Run `vercel inspect <deployment-url> --wait` and require the deployment to reach Ready.
6. Smoke-test the public home/login surface with `vercel curl / --deployment <deployment-url>` or an equivalent read-only request. Do not weaken Deployment Protection to test it.

The phrase "deploy web" targets production, not a preview. A preview requires an explicit preview request and uses `vercel deploy` without `--prod`.

## Status and rollback

- Status: use `vercel ls`, then `vercel inspect <url-or-id>` and relevant logs.
- Rollback only on an explicit rollback request. Inspect the intended destination first, then use `vercel rollback <url-or-id>`.
- If a production deployment succeeds but the smoke test fails, report the live deployment and failure. Do not roll it back without authorization.
