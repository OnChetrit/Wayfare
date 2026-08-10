import { NextResponse } from 'next/server';
import { z } from 'zod';
import { categoryMeta } from '@/features/trip-editor/data';
import type { PlaceCategory, SavedPlace } from '@/features/trip-editor/types';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { getGooglePlacePhotoImages, type GooglePlacePhoto } from '@/lib/google-places/photos';

const placeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);

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

export async function GET(_request: Request, context: { params: Promise<{ placeId: string }> }) {
  const { placeId: rawPlaceId } = await context.params;
  const placeId = placeIdSchema.safeParse(rawPlaceId);
  if (!placeId.success)
    return NextResponse.json({ error: 'Invalid Google place ID' }, { status: 400 });

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

  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId.data}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,location,rating,types,googleMapsUri,photos',
    },
    cache: 'no-store',
  });
  if (!response.ok)
    return NextResponse.json({ error: 'Google Places details failed' }, { status: 502 });

  const place = (await response.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    types?: string[];
    googleMapsUri?: string;
    photos?: GooglePlacePhoto[];
  };
  if (
    !place.id ||
    !place.displayName?.text ||
    place.location?.latitude == null ||
    place.location.longitude == null
  )
    return NextResponse.json(
      { error: 'Google Places returned incomplete details' },
      { status: 502 },
    );

  const category = getCategory(place.types);
  const savedPlace: SavedPlace = {
    id: `google-${place.id}`,
    name: place.displayName.text,
    subtitle: place.formattedAddress ?? 'Saved from Google Maps',
    category,
    emoji: categoryMeta[category].emoji,
    color: categoryMeta[category].color,
    lat: place.location.latitude,
    lng: place.location.longitude,
    rating: place.rating,
    provider: 'GOOGLE',
    providerPlaceId: place.id,
    googleMapsUri: place.googleMapsUri,
    photos: await getGooglePlacePhotoImages(apiKey, place.photos),
  };

  return NextResponse.json({ place: savedPlace });
}
