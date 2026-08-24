import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { flightFromDatabase, flightSelect } from '@/lib/trips/flights';
import { expenseFromDatabase, expenseSelect } from '@/lib/trips/expenses';
import { categoryMeta } from '@/features/trip-editor/data';
import type {
  PlaceCategory,
  SavedPlace,
  TripDay,
  TripEditorTrip,
  TripEditorUser,
  TripSummary,
  LocationSegment,
  Stay,
  UserPreferences,
} from '@/features/trip-editor/types';

const tripDaySelect = 'id, local_date, title, notes';

function getMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof metadata[key] === 'string' && metadata[key]) return metadata[key] as string;
  }
  return '';
}

function toTripDay(row: {
  id: string;
  local_date: string;
  title: string | null;
  notes: string | null;
}): TripDay {
  const date = new Date(`${row.local_date}T12:00:00Z`);
  return {
    id: row.id,
    date: row.local_date,
    label: new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
      .format(date)
      .toUpperCase(),
    shortDate: new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(date),
    notes: row.notes ?? undefined,
  };
}

function categoryFromDatabase(value: string): PlaceCategory {
  return value in categoryMeta ? (value as PlaceCategory) : 'CUSTOM';
}

function placeFromDatabase(row: {
  id: string;
  provider: 'GOOGLE' | 'CUSTOM';
  provider_place_id: string | null;
  category: string;
  custom_name: string | null;
  custom_latitude: number | null;
  custom_longitude: number | null;
  is_favorite: boolean;
  user_notes: string | null;
  location_segment_ids?: string[];
}): SavedPlace | null {
  if (row.custom_latitude == null || row.custom_longitude == null) return null;
  const category = categoryFromDatabase(row.category);
  return {
    id: row.id,
    name: row.custom_name ?? 'Saved place',
    subtitle: row.provider_place_id ? 'Saved from Google Maps' : 'Custom place',
    category,
    emoji: categoryMeta[category].emoji,
    color: categoryMeta[category].color,
    lat: row.custom_latitude,
    lng: row.custom_longitude,
    provider: row.provider,
    providerPlaceId: row.provider_place_id ?? undefined,
    isFavorite: row.is_favorite,
    comment: row.user_notes ?? undefined,
    locationSegmentIds: row.location_segment_ids ?? [],
  };
}

function locationSegmentFromDatabase(row: {
  id: string;
  trip_id: string;
  location_name: string;
  country: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string;
  end_date: string;
}): LocationSegment {
  return {
    id: row.id,
    tripId: row.trip_id,
    locationName: row.location_name,
    country: row.country ?? undefined,
    area: row.area ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

function stayFromDatabase(row: {
  id: string;
  trip_id: string;
  name: string;
  saved_place_id: string | null;
  address: string | null;
  location_label: string | null;
  price: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  cancellation_time: string | null;
  check_in_date: string;
  check_out_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  confirmation_number: string | null;
  secret_code: string | null;
  notes: string | null;
}): Stay {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    savedPlaceId: row.saved_place_id,
    address: row.address ?? undefined,
    locationLabel: row.location_label ?? undefined,
    price: row.price ?? undefined,
    priceAmount: row.price_amount == null ? undefined : Number(row.price_amount),
    priceCurrency: row.price_currency ?? undefined,
    cancellationTime: row.cancellation_time ?? undefined,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    checkInTime: row.check_in_time ?? undefined,
    checkOutTime: row.check_out_time ?? undefined,
    confirmationNumber: row.confirmation_number ?? undefined,
    secretCode: row.secret_code ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function getHomeData(selectedTripId?: string): Promise<{
  user: TripEditorUser | null;
  trip: TripEditorTrip | null;
  trips: TripSummary[];
}> {
  if (!isSupabaseConfigured()) return { user: null, trip: null, trips: [] };

  const cookieClient = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await cookieClient.auth.getSession();
  if (sessionError || !session?.access_token) return { user: null, trip: null, trips: [] };
  const supabase = await createClient(session.access_token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, trip: null, trips: [] };

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metadataPreferences = (metadata.preferences ?? {}) as Record<string, unknown>;
  const preferences: UserPreferences = {
    timeZone: getMetadataString(metadataPreferences, ['timeZone']) || 'Europe/Madrid',
    currency: getMetadataString(metadataPreferences, ['currency']) || 'EUR',
    theme: ['system', 'light', 'dark'].includes(metadataPreferences.theme as string)
      ? (metadataPreferences.theme as UserPreferences['theme'])
      : 'system',
  };
  const appUser: TripEditorUser = {
    id: user.id,
    email: user.email ?? null,
    name:
      getMetadataString(metadata, ['full_name', 'name']) || user.email?.split('@')[0] || 'Wayfarer',
    avatarUrl: getMetadataString(metadata, ['avatar_url', 'picture']) || null,
    lastTripId: getMetadataString(metadata, ['lastTripId']) || undefined,
    preferences,
  };

  const { data: trips } = await supabase
    .from('trips')
    .select(
      'id, name, start_date, end_date, destination_label, default_time_zone, default_currency',
    )
    .order('start_date', { ascending: true })
    .order('name', { ascending: true });

  const tripSummaries: TripSummary[] = (trips ?? []).map(row => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    destinationLabel: row.destination_label,
  }));
  const tripRow =
    (selectedTripId ? trips?.find(row => row.id === selectedTripId) : undefined) ??
    (appUser.lastTripId ? trips?.find(row => row.id === appUser.lastTripId) : undefined) ??
    trips?.[0];
  if (!tripRow) return { user: appUser, trip: null, trips: tripSummaries };

  const [
    { data: dayRows },
    { data: placeRows },
    { data: locationSegmentRows },
    { data: stayRows },
    { data: flightRows },
    { data: expenseRows },
  ] = await Promise.all([
    supabase.from('trip_days').select(tripDaySelect).eq('trip_id', tripRow.id).order('local_date'),
    supabase
      .from('saved_places')
      .select(
        'id, provider, provider_place_id, category, custom_name, custom_latitude, custom_longitude, is_favorite, user_notes',
      )
      .eq('trip_id', tripRow.id),
    supabase
      .from('trip_location_segments')
      .select(
        'id, trip_id, location_name, country, area, latitude, longitude, start_date, end_date',
      )
      .eq('trip_id', tripRow.id)
      .order('start_date'),
    supabase
      .from('stays')
      .select(
        'id, trip_id, name, saved_place_id, address, location_label, price, price_amount, price_currency, cancellation_time, check_in_date, check_out_date, check_in_time, check_out_time, confirmation_number, secret_code, notes',
      )
      .eq('trip_id', tripRow.id)
      .order('check_in_date'),
    supabase
      .from('trip_flights')
      .select(flightSelect)
      .eq('trip_id', tripRow.id)
      .order('departure_date')
      .order('scheduled_departure_utc'),
    supabase
      .from('trip_expenses')
      .select(expenseSelect)
      .eq('trip_id', tripRow.id)
      .order('expense_date')
      .order('created_at'),
  ]);

  const days = (dayRows ?? []).map(toTripDay);
  const places = (placeRows ?? [])
    .map(placeFromDatabase)
    .filter((place): place is SavedPlace => place !== null);
  const placeIds = places.map(place => place.id);
  const locationSegmentIds = (locationSegmentRows ?? []).map(segment => segment.id);
  const [locationPlacesResult, scheduleResult] = await Promise.all([
    locationSegmentIds.length
      ? supabase
          .from('trip_location_segment_places')
          .select('location_segment_id, saved_place_id')
          .in('location_segment_id', locationSegmentIds)
      : Promise.resolve({ data: [], error: null }),
    dayRows?.length
      ? supabase
          .from('schedule_items')
          .select(
            'id, trip_day_id, saved_place_id, start_at_utc, duration_minutes, sort_order, title_override, category, notes, amount, currency',
          )
          .in(
            'trip_day_id',
            dayRows.map(row => row.id),
          )
          .order('sort_order')
      : Promise.resolve({ data: [] }),
  ]);
  const { data: locationPlaceRows, error: locationPlaceError } = locationPlacesResult;
  if (locationPlaceError) {
    throw new Error(`Could not load location places: ${locationPlaceError.message}`);
  }

  const placeIdSet = new Set(placeIds);
  const locationSegmentIdsByPlace = new Map<string, string[]>();
  (locationPlaceRows ?? []).forEach(row => {
    if (!placeIdSet.has(row.saved_place_id)) return;
    const ids = locationSegmentIdsByPlace.get(row.saved_place_id) ?? [];
    ids.push(row.location_segment_id);
    locationSegmentIdsByPlace.set(row.saved_place_id, ids);
  });
  places.forEach(place => {
    place.locationSegmentIds = locationSegmentIdsByPlace.get(place.id) ?? [];
  });
  const { data: scheduleRows } = scheduleResult;

  const dayById = new Map((dayRows ?? []).map(row => [row.id, row.local_date]));
  const schedule = (scheduleRows ?? []).flatMap(row => {
    const date = dayById.get(row.trip_day_id);
    if (!date || (row.saved_place_id && !placeIds.includes(row.saved_place_id))) return [];
    const time = row.start_at_utc
      ? new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: tripRow.default_time_zone ?? 'Europe/Madrid',
        }).format(new Date(row.start_at_utc))
      : '09:00';
    return [
      {
        id: row.id,
        savedPlaceId: row.saved_place_id,
        date,
        startTime: time,
        duration: row.duration_minutes ?? 60,
        note: row.notes ?? undefined,
        title: row.title_override ?? undefined,
        category: row.category ? categoryFromDatabase(row.category) : undefined,
        amount: row.amount == null ? undefined : Number(row.amount),
        currency: row.currency ?? undefined,
      },
    ];
  });

  return {
    user: appUser,
    trips: tripSummaries,
    trip: {
      id: tripRow.id,
      name: tripRow.name,
      startDate: tripRow.start_date,
      endDate: tripRow.end_date,
      destinationLabel: tripRow.destination_label,
      defaultTimeZone: tripRow.default_time_zone,
      defaultCurrency: tripRow.default_currency,
      days,
      places,
      schedule,
      locationSegments: (locationSegmentRows ?? []).map(locationSegmentFromDatabase),
      stays: (stayRows ?? []).map(stayFromDatabase),
      flights: (flightRows ?? []).map(flightFromDatabase),
      expenses: (expenseRows ?? []).map(row =>
        expenseFromDatabase(row as Parameters<typeof expenseFromDatabase>[0]),
      ),
    },
  };
}
