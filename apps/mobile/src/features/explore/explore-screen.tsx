import { useQuery } from '@tanstack/react-query';
import SavedPlacesIcon from '@expo/material-symbols/list.xml';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createPlace, searchGooglePlaces, type GooglePlaceSearchResult } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { TripMap, type MapPlace } from '@/components/trip-map';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { mapPlacesForExplore, toMapPlace } from '@/features/explore/saved-place-map';
import { SavedPlacesDrawer } from '@/features/explore/saved-places-drawer';
import { messageFromError } from '@/lib/format';
import { colors } from '@/theme/tokens';

export function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const tripQuery = useTripEditor();
  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query.trim());
  const [selectedPlace, setSelectedPlace] = React.useState<MapPlace | null>(null);
  const [savedPlacesVisible, setSavedPlacesVisible] = React.useState(false);
  const [visibleMapPlaceIds, setVisibleMapPlaceIds] = React.useState<string[]>([]);
  const trip = tripQuery.data;
  const firstSavedPlace = trip?.places[0];
  const initialPlace = React.useMemo(
    () => (firstSavedPlace ? toMapPlace(firstSavedPlace) : null),
    [firstSavedPlace],
  );
  const activePlace = selectedPlace ?? initialPlace;
  const mapPlaces = React.useMemo(
    () => (trip ? mapPlacesForExplore(trip.places, activePlace) : []),
    [activePlace, trip],
  );
  const placesQuery = useQuery({
    queryKey: ['places-search', trip?.id, deferredQuery],
    queryFn: ({ signal }) => searchGooglePlaces(deferredQuery, trip?.destinationLabel, signal),
    enabled: Boolean(trip && deferredQuery.length >= 2),
    staleTime: 60_000,
  });
  const { isOnline, mutation: savePlaceMutation } = useTripMutation(
    trip?.id ?? '',
    (place: GooglePlaceSearchResult) =>
      createPlace(trip!.id, {
        name: place.name,
        category: 'CUSTOM',
        lat: place.lat,
        lng: place.lng,
        provider: 'GOOGLE',
        providerPlaceId: place.providerPlaceId,
      }),
  );

  if (tripQuery.isLoading) return <LoadingState label="Loading map…" />;
  if (tripQuery.error)
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  if (!trip)
    return (
      <EmptyState title="No trip selected" detail="Choose a trip to explore places around it." />
    );
  const showResults = deferredQuery.length >= 2;
  const searchPlaceholder = trip.destinationLabel
    ? `Search ${trip.destinationLabel}`
    : 'Search Google Places';
  const currentTrip = trip;

  function showSavedPlace(place: (typeof currentTrip.places)[number]) {
    setSelectedPlace(toMapPlace(place));
    setSavedPlacesVisible(false);
    router.push({ pathname: '/place-actions', params: { placeId: place.id } });
  }

  function showMapPlace(place: MapPlace) {
    setSelectedPlace(place);
    const savedPlace = currentTrip.places.find(candidate => candidate.id === place.id);
    if (savedPlace) showSavedPlace(savedPlace);
  }

  return (
    <>
      <View style={{ backgroundColor: colors.background, flex: 1 }}>
        <TripMap
          onSelectPlace={showMapPlace}
          onVisiblePlacesChange={setVisibleMapPlaceIds}
          places={mapPlaces}
          selectedPlace={activePlace}
        />
        <View
          style={{
            bottom: Math.max(insets.bottom + 16, 16),
            gap: 8,
            left: 16,
            position: 'absolute',
            right: 16,
          }}
        >
          <OfflineNotice visible={!isOnline} />
          {showResults ? (
            <Card style={{ maxHeight: 360 }}>
              {placesQuery.isLoading ? (
                <View
                  style={{ alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 8 }}
                >
                  <ActivityIndicator color={colors.accent} />
                  <Text selectable style={{ color: colors.textMuted }}>
                    Searching Google Places…
                  </Text>
                </View>
              ) : null}
              {placesQuery.error ? (
                <Text selectable style={{ color: colors.danger }}>
                  {messageFromError(placesQuery.error, 'Google Places is unavailable right now.')}
                </Text>
              ) : null}
              {!placesQuery.isLoading && !placesQuery.error && !placesQuery.data?.length ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  No places found for “{deferredQuery}”.
                </Text>
              ) : null}
              {placesQuery.data?.map(place => (
                <Pressable
                  accessibilityHint="Centers this place on the map"
                  accessibilityLabel={`Show ${place.name} on the map`}
                  accessibilityRole="button"
                  key={place.id}
                  onPress={() => setSelectedPlace(toMapPlace(place))}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: 10,
                    opacity: pressed ? 0.72 : 1,
                    paddingVertical: 7,
                  })}
                >
                  <Text selectable style={{ fontSize: 20 }}>
                    {place.emoji ?? '⌖'}
                  </Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      selectable
                      numberOfLines={1}
                      style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}
                    >
                      {place.name}
                    </Text>
                    <Text
                      selectable
                      numberOfLines={1}
                      style={{ color: colors.textMuted, fontSize: 13 }}
                    >
                      {place.subtitle}
                    </Text>
                  </View>
                  <Button
                    disabled={!isOnline || savePlaceMutation.isPending}
                    onPress={() => void savePlaceMutation.mutateAsync(place)}
                  >
                    Save
                  </Button>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </View>
        {savedPlacesVisible ? (
          <SavedPlacesDrawer
            onClose={() => setSavedPlacesVisible(false)}
            onSelectPlace={showSavedPlace}
            places={trip.places}
            selectedPlaceId={activePlace?.id}
            visiblePlaceIds={visibleMapPlaceIds}
            visible
          />
        ) : null}
      </View>
      <Stack.SearchBar
        autoCapitalize="none"
        barTintColor="#F8F4EB"
        hideNavigationBar={false}
        onCancelButtonPress={() => setQuery('')}
        onChangeText={event => setQuery(event.nativeEvent.text)}
        obscureBackground={false}
        placeholder={searchPlaceholder}
        placement="stacked"
        textColor="#102A21"
        tintColor="#E9F5ED"
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={`Open ${trip.places.length} saved places`}
          icon={process.env.EXPO_OS === 'ios' ? 'list.bullet' : SavedPlacesIcon}
          onPress={() => setSavedPlacesVisible(true)}
        />
      </Stack.Toolbar>
    </>
  );
}
