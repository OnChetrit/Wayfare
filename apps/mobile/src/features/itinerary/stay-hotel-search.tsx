import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { Text, View } from 'react-native';

import type { SavedPlace } from '@wayfare/domain';
import { createPlace, searchGooglePlaces, type GooglePlaceSearchResult } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { messageFromError } from '@/lib/format';
import { colors } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

type HotelCandidate = Pick<SavedPlace, 'id' | 'name' | 'subtitle'> & {
  providerPlaceId?: string;
};

type HotelSearchProps = {
  destinationLabel?: string | null;
  onSelect: (hotel: { address?: string; id: string; name: string }) => void;
  places: SavedPlace[];
  tripId: string;
};

function isHotel(place: Pick<SavedPlace, 'category'>) {
  return place.category === 'HOTEL';
}

function matchingHotels(places: SavedPlace[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return places
    .filter(isHotel)
    .filter(
      place =>
        !normalized || `${place.name} ${place.subtitle}`.toLocaleLowerCase().includes(normalized),
    )
    .slice(0, 4);
}

function hotelSearchResults(
  googleResults: GooglePlaceSearchResult[] | undefined,
  savedPlaces: SavedPlace[],
) {
  return (googleResults ?? []).filter(
    place =>
      isHotel(place) && !savedPlaces.some(saved => saved.providerPlaceId === place.providerPlaceId),
  );
}

export function StayHotelSearch({ destinationLabel, onSelect, places, tripId }: HotelSearchProps) {
  useTheme();
  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query.trim());
  const localHotels = React.useMemo(() => matchingHotels(places, query), [places, query]);
  const googleQuery = useQuery({
    queryKey: ['hotel-search', tripId, destinationLabel, deferredQuery],
    queryFn: ({ signal }) => searchGooglePlaces(deferredQuery, destinationLabel, signal),
    enabled: deferredQuery.length >= 2,
    staleTime: 5 * 60_000,
  });
  const { isOnline, mutation: saveHotelMutation } = useTripMutation(
    tripId,
    (place: GooglePlaceSearchResult) =>
      createPlace(tripId, {
        name: place.name,
        category: place.category,
        lat: place.lat,
        lng: place.lng,
        provider: 'GOOGLE',
        providerPlaceId: place.providerPlaceId,
      }),
  );
  const googleHotels = hotelSearchResults(googleQuery.data, places);

  function selectSavedHotel(hotel: HotelCandidate) {
    onSelect({ id: hotel.id, name: hotel.name, address: hotel.subtitle });
  }

  async function selectGoogleHotel(hotel: GooglePlaceSearchResult) {
    try {
      const result = await saveHotelMutation.mutateAsync(hotel);
      onSelect({ id: result.place.id, name: hotel.name, address: hotel.subtitle });
    } catch {
      // The mutation error is rendered below, alongside the search result that triggered it.
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Field
        accessibilityLabel="Search Google Maps for a hotel"
        label="Search Google Maps for a hotel"
        onChangeText={setQuery}
        placeholder={destinationLabel ? `Hotels in ${destinationLabel}` : 'Hotel name'}
        returnKeyType="search"
        value={query}
      />
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
        Select a saved hotel or search Google Maps to link its place details to this stay.
      </Text>
      {localHotels.map(hotel => (
        <Card key={hotel.id} style={{ gap: 6 }}>
          <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
            {hotel.name}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            {hotel.subtitle}
          </Text>
          <Button
            accessibilityLabel={`Link saved hotel ${hotel.name}`}
            disabled={!isOnline}
            onPress={() => selectSavedHotel(hotel)}
            tone="secondary"
          >
            Link saved hotel
          </Button>
        </Card>
      ))}
      {googleQuery.isFetching ? (
        <Text selectable style={{ color: colors.textMuted }}>
          Searching Google Maps…
        </Text>
      ) : null}
      {googleHotels.map(hotel => (
        <Card key={hotel.id} style={{ gap: 6 }}>
          <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
            {hotel.name}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            {hotel.subtitle}
          </Text>
          <Button
            accessibilityLabel={`Save and link hotel ${hotel.name}`}
            disabled={!isOnline || saveHotelMutation.isPending}
            loading={saveHotelMutation.isPending}
            onPress={() => void selectGoogleHotel(hotel)}
          >
            Save and link hotel
          </Button>
        </Card>
      ))}
      {deferredQuery.length >= 2 && !googleQuery.isFetching && !googleHotels.length ? (
        <Text selectable style={{ color: colors.textMuted }}>
          No new hotel matches from Google Maps.
        </Text>
      ) : null}
      {googleQuery.error || saveHotelMutation.error ? (
        <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
          {messageFromError(googleQuery.error ?? saveHotelMutation.error)}
        </Text>
      ) : null}
    </View>
  );
}
