import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { getTripEditorContext } from '@/lib/trips/flight-auth';
import {
  flightCandidateFromProvider,
  type AeroDataBoxFlight,
  type TripFlightCandidate,
} from '@/lib/trips/flights';

const searchSchema = z.object({
  flightNumber: z.string().trim().min(2).max(20),
  departureDate: z.iso.date(),
});

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = searchSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const contextResult = await getTripEditorContext(auth.supabase, auth.user, tripId);
  if ('error' in contextResult)
    return NextResponse.json({ error: contextResult.error }, { status: 403 });
  if (
    result.data.departureDate < contextResult.trip.start_date ||
    result.data.departureDate > contextResult.trip.end_date
  ) {
    return NextResponse.json(
      { error: 'The flight departure date must be inside the trip dates.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.AERODATABOX_API_KEY;
  const apiHost = (process.env.AERODATABOX_API_HOST ?? 'aerodatabox.p.rapidapi.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AeroDataBox is not configured. Add AERODATABOX_API_KEY to .env.local.' },
      { status: 500 },
    );
  }

  const providerUrl = new URL(
    `https://${apiHost}/flights/number/${encodeURIComponent(result.data.flightNumber)}/${result.data.departureDate}`,
  );
  // The date entered in trip settings can be either the departure date
  // (outbound flight) or the arrival date (return/inbound flight). Searching
  // by departure only made overnight flights into the trip disappear.
  providerUrl.searchParams.set('dateLocalRole', 'Both');

  let providerResponse: Response;
  try {
    providerResponse = await fetch(providerUrl, {
      headers: {
        Accept: 'application/json',
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost,
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the flight data provider.' },
      { status: 502 },
    );
  }

  const providerBody = await providerResponse.json().catch(() => null);
  if (!providerResponse.ok) {
    const providerError =
      providerBody && typeof providerBody === 'object'
        ? (providerBody as { message?: unknown; details?: unknown })
        : {};
    const message =
      typeof providerError.message === 'string'
        ? providerError.message
        : typeof providerError.details === 'string'
          ? providerError.details
          : 'The flight provider could not find that flight.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const candidates = Array.isArray(providerBody)
    ? providerBody
        .map(item => flightCandidateFromProvider(item as AeroDataBoxFlight))
        .filter((item): item is TripFlightCandidate => item !== null)
    : [];
  const uniqueCandidates = candidates.filter(
    (candidate, index, all) =>
      all.findIndex(
        other =>
          other.flightNumber === candidate.flightNumber &&
          other.scheduledDepartureUtc === candidate.scheduledDepartureUtc,
      ) === index,
  );

  return NextResponse.json({ flights: uniqueCandidates });
}
