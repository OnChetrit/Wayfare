# Wayfare

Wayfare is a map-first self-trip planner built from the product plan in `../Trip Planner IDE Plan.md`.

The app requires Supabase for authentication and data persistence. It includes the trip editor shell, date navigation, saved-place library, scheduling, and a responsive mobile mode.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Supabase setup

Create a Supabase project, copy its Project URL and Publishable key into `.env.local` using the names in `.env.example`, then apply `supabase/migrations/20260809132242_wayfare_foundation.sql` in the Supabase SQL Editor. The migration creates the trip foundation tables and enables Row Level Security. Open `/login` or `/signup` to test email/password auth.

To enable Google sign-in, enable Google under Supabase Dashboard → Authentication → Providers, add the Supabase callback URL shown there to Google Cloud Console, and add these app callback URLs under Authentication → URL Configuration:

```text
http://localhost:3000/auth/callback
https://your-production-domain.com/auth/callback
```

For email confirmation with SSR cookies, set the Supabase Confirm signup email template to use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

The live map uses two Google Maps Platform credentials: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is a browser-restricted Maps JavaScript key, and `GOOGLE_MAPS_SERVER_API_KEY` is a server-only key used by `/api/places` for Places API (New) Text Search. Enable Maps JavaScript API, Places API (New), and billing in Google Cloud. Set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` to a map ID so Advanced Markers can render.

Flight search uses AeroDataBox through RapidAPI. Add the RapidAPI key to `.env.local` as `AERODATABOX_API_KEY`; `AERODATABOX_API_HOST=aerodatabox.p.rapidapi.com` is optional because it is the default. Keep both variables server-only. Apply the latest Supabase migration before opening a trip with flights.

## Current domain model

`SavedPlace` is the reusable library record. `ScheduleItem` is a dated occurrence of that saved place. A place can therefore be scheduled more than once without duplicating its library record.
