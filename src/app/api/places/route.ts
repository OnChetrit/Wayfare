import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { getGooglePlacePhotoImages, type GooglePlacePhoto } from '@/lib/google-places/photos';
import { categoryMeta } from '@/features/trip-editor/data';
import type { PlaceCategory } from '@/features/trip-editor/types';

const querySchema = z.string().trim().min(2).max(120);
const destinationSchema = z.string().trim().min(1).max(120).optional();

function getCategory(types: string[] = []): PlaceCategory {
  if (types.some(type => ['lodging', 'hotel'].includes(type))) return 'HOTEL';
  if (types.includes('restaurant') || types.includes('food')) return 'RESTAURANT';
  if (types.includes('bar')) return 'BAR';
  if (types.includes('cafe')) return 'CAFE';
  if (types.some(type => ['store', 'shopping_mall', 'market'].includes(type))) return 'SHOPPING';
  if (
    types.some(type => ['park', 'museum', 'tourist_attraction', 'point_of_interest'].includes(type))
  )
    return 'ATTRACTION';
  return 'CUSTOM';
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = querySchema.safeParse(searchParams.get('query') ?? '');
  if (!query.success) return NextResponse.json({ places: [] });
  const destination = destinationSchema.safeParse(searchParams.get('destination') ?? undefined);
  const destinationLabel = destination.success ? destination.data : undefined;

  if (!isSupabaseConfigured())
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  const cookieClient = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await cookieClient.auth.getSession();
  if (sessionError || !session?.access_token)
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const supabase = await createClient(session.access_token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: 'Google Places is not configured' }, { status: 503 });

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types,places.googleMapsUri,places.photos',
    },
    body: JSON.stringify({
      textQuery: destinationLabel ? `${query.data} in ${destinationLabel}` : query.data,
      pageSize: 8,
      languageCode: 'en',
    }),
    cache: 'no-store',
  });

  if (!response.ok)
    return NextResponse.json({ error: 'Google Places search failed' }, { status: 502 });
  const payload = (await response.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      rating?: number;
      types?: string[];
      googleMapsUri?: string;
      photos?: GooglePlacePhoto[];
    }>;
  };

  const places = (
    await Promise.all(
      (payload.places ?? []).map(async place => {
        if (
          !place.id ||
          !place.displayName?.text ||
          place.location?.latitude == null ||
          place.location.longitude == null
        )
          return null;
        const category = getCategory(place.types);
        return {
          id: `google-${place.id}`,
          name: place.displayName.text,
          subtitle: place.formattedAddress ?? destinationLabel ?? 'Saved from Google Maps',
          category,
          emoji: categoryMeta[category].emoji,
          color: categoryMeta[category].color,
          lat: place.location.latitude,
          lng: place.location.longitude,
          rating: place.rating,
          provider: 'GOOGLE' as const,
          providerPlaceId: place.id,
          googleMapsUri: place.googleMapsUri,
          photos: await getGooglePlacePhotoImages(apiKey, place.photos),
        };
      }),
    )
  ).filter(place => place !== null);

  return NextResponse.json({ places });
}
