import { NextResponse } from 'next/server';
import { z } from 'zod';
import { categoryMeta } from '@/features/trip-editor/data';
import type { PlaceCategory } from '@/features/trip-editor/types';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const MAX_IMPORTED_PLACES = 250;
const GOOGLE_LIST_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'maps.app.goo.gl',
]);
const importSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine(isGoogleMapsListUrl, 'Paste a Google Maps shared list link.'),
});

type SharedPlace = {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  providerPlaceId?: string;
  googleMapsUri?: string;
};

function isGoogleMapsListUrl(value: string) {
  try {
    const url = new URL(value);
    if (!GOOGLE_LIST_HOSTS.has(url.hostname)) return false;
    return url.hostname === 'maps.app.goo.gl' || url.pathname.includes('/maps/');
  } catch {
    return false;
  }
}

function isGoogleHost(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return (
      hostname === 'maps.app.goo.gl' ||
      hostname === 'google.com' ||
      hostname.endsWith('.google.com')
    );
  } catch {
    return false;
  }
}

async function fetchText(url: string, headers?: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Google Maps returned ${response.status}.`);
    if (!isGoogleHost(response.url))
      throw new Error('Google Maps redirected to an unsupported host.');
    return { text: await response.text(), finalUrl: response.url };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function extractListEndpoint(pageHtml: string, pageUrl: string) {
  const match = pageHtml.match(/href="([^"]*entitylist\/getlist[^"]*)"/);
  if (!match) throw new Error('This Google Maps link is private, invalid, or not a shared list.');
  const endpoint = new URL(decodeHtml(match[1]), pageUrl);
  if (!isGoogleHost(endpoint.href)) throw new Error('The Google Maps list endpoint is invalid.');
  return endpoint.href;
}

function stripXssi(value: string) {
  return value.replace(/^\)\]\}'\s*/, '');
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function validCoordinatePair(latitude: number | undefined, longitude: number | undefined) {
  return (
    latitude !== undefined &&
    longitude !== undefined &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function parseSharedList(raw: string) {
  let data: unknown;
  try {
    data = JSON.parse(stripXssi(raw));
  } catch {
    throw new Error('Google Maps returned an unreadable list.');
  }

  const response = asArray(data);
  const root = asArray(response?.[0]);
  if (!root) throw new Error('Google Maps returned an unexpected list format.');

  const listName = asString(root[4]) ?? 'Google Maps list';
  const items = asArray(root[8]);
  if (!items) throw new Error('This Google Maps list has no readable places.');

  const places: SharedPlace[] = [];
  for (const value of items.slice(0, MAX_IMPORTED_PLACES)) {
    const item = asArray(value);
    const placeInfo = asArray(item?.[1]);
    const name = asString(item?.[2]);
    if (!name || !placeInfo) continue;

    const coordinates = asArray(placeInfo[5]);
    const latitude = asNumber(coordinates?.[2]);
    const longitude = asNumber(coordinates?.[3]);
    if (!validCoordinatePair(latitude, longitude)) continue;

    const providerPlaceId = asString(placeInfo[7]);
    places.push({
      name,
      address: asString(placeInfo[2]) ?? asString(placeInfo[4]),
      latitude,
      longitude,
      providerPlaceId,
      googleMapsUri: providerPlaceId
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(providerPlaceId)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
    });
  }

  return { listName, places, sourceCount: items.length };
}

function importedCategory(listName: string, placeName: string): PlaceCategory {
  const value = `${listName} ${placeName}`.toLowerCase();
  if (/hotel|hostel|resort|inn|lodging/.test(value)) return 'HOTEL';
  if (/restaurant|ramen|pizza|sushi|bakery|food|grill|cuisine|dining/.test(value))
    return 'RESTAURANT';
  if (/bar|pub|cocktail|wine/.test(value)) return 'BAR';
  if (/cafe|coffee|brunch/.test(value)) return 'CAFE';
  if (/shop|market|mall|store|boutique/.test(value)) return 'SHOPPING';
  return 'CUSTOM';
}

function samePlace(
  left: {
    provider_place_id: string | null;
    custom_name: string | null;
    custom_latitude: number | null;
    custom_longitude: number | null;
  },
  right: SharedPlace,
) {
  if (left.provider_place_id && right.providerPlaceId) {
    return left.provider_place_id === right.providerPlaceId;
  }
  return (
    left.custom_name?.trim().toLowerCase() === right.name.trim().toLowerCase() &&
    left.custom_latitude != null &&
    left.custom_longitude != null &&
    right.latitude != null &&
    right.longitude != null &&
    Math.abs(left.custom_latitude - right.latitude) < 0.00001 &&
    Math.abs(left.custom_longitude - right.longitude) < 0.00001
  );
}

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const result = importSchema.safeParse(await request.json().catch(() => ({})));
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  let parsed: ReturnType<typeof parseSharedList>;
  try {
    const page = await fetchText(result.data.url);
    const endpoint = extractListEndpoint(page.text, page.finalUrl);
    const payload = await fetchText(endpoint, {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36',
    });
    parsed = parseSharedList(payload.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read the Google Maps list.';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { data: existing, error: existingError } = await auth.supabase
    .from('saved_places')
    .select('provider_place_id, custom_name, custom_latitude, custom_longitude')
    .eq('trip_id', tripId);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });

  const newPlaces = parsed.places.filter(
    (place, index, all) =>
      !existing?.some(row => samePlace(row, place)) &&
      all.findIndex(candidate =>
        samePlace(
          {
            provider_place_id: candidate.providerPlaceId ?? null,
            custom_name: candidate.name,
            custom_latitude: candidate.latitude ?? null,
            custom_longitude: candidate.longitude ?? null,
          },
          place,
        ),
      ) === index,
  );
  if (!newPlaces.length) {
    return NextResponse.json({
      listName: parsed.listName,
      places: [],
      importedCount: 0,
      skippedCount: parsed.sourceCount,
    });
  }

  const rows = newPlaces.map(place => ({
    trip_id: tripId,
    provider: place.providerPlaceId ? 'GOOGLE' : 'CUSTOM',
    provider_place_id: place.providerPlaceId ?? null,
    category: importedCategory(parsed.listName, place.name),
    custom_name: place.name,
    custom_latitude: place.latitude,
    custom_longitude: place.longitude,
    created_by: auth.user.id,
  }));
  const { data: inserted, error: insertError } = await auth.supabase
    .from('saved_places')
    .insert(rows)
    .select(
      'id, provider, provider_place_id, category, custom_name, custom_latitude, custom_longitude, is_favorite',
    );
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const places = (inserted ?? []).flatMap(row => {
    if (row.custom_latitude == null || row.custom_longitude == null) return [];
    const source = newPlaces.find(place =>
      samePlace(
        {
          provider_place_id: row.provider_place_id,
          custom_name: row.custom_name,
          custom_latitude: row.custom_latitude,
          custom_longitude: row.custom_longitude,
        },
        place,
      ),
    );
    const category = row.category as PlaceCategory;
    return [
      {
        id: row.id,
        name: row.custom_name ?? 'Saved place',
        subtitle: source?.address ?? parsed.listName,
        category,
        emoji: categoryMeta[category].emoji,
        color: categoryMeta[category].color,
        lat: row.custom_latitude,
        lng: row.custom_longitude,
        provider: row.provider as 'GOOGLE' | 'CUSTOM',
        providerPlaceId: row.provider_place_id ?? undefined,
        googleMapsUri: source?.googleMapsUri,
        isFavorite: row.is_favorite,
      },
    ];
  });

  return NextResponse.json({
    listName: parsed.listName,
    places,
    importedCount: places.length,
    skippedCount: parsed.sourceCount - places.length,
  });
}
