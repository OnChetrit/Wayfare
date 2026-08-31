import { useQuery } from '@tanstack/react-query';
import ImportIcon from '@expo/material-symbols/playlist_add.xml';
import SavedPlacesIcon from '@expo/material-symbols/list.xml';
import { router, Stack } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  assignPlaceToSegment,
  createPlace,
  removePlaceFromSegment,
  searchGooglePlaces,
  type GooglePlaceSearchResult,
} from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { Screen } from '@/components/ui/screen';
import { TripMap, type MapPlace } from '@/components/trip-map';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { toMapPlace } from '@/features/explore/saved-place-map';
import { SavedPlacesDrawer } from '@/features/explore/saved-places-drawer';
import { tripDaysForExplore } from '@/features/explore/explore-trip-days';
import { useDayPlanMap } from '@/features/itinerary/use-day-plan-map';
import { messageFromError } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

function haveSamePlaceIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((placeId, index) => placeId === right[index]);
}

export function ExploreScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tripQuery = useTripEditor();
  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query.trim());
  const [selectedPlace, setSelectedPlace] = React.useState<MapPlace | null>(null);
  const [savedPlacesVisible, setSavedPlacesVisible] = React.useState(false);
  const [locationScopeId, setLocationScopeId] = React.useState<string>();
  const [locationMessage, setLocationMessage] = React.useState<string | null>(null);
  const [visibleMapPlaceIds, setVisibleMapPlaceIds] = React.useState<string[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<string>();
  const trip = tripQuery.data;
  const exploreDays = React.useMemo(() => tripDaysForExplore(trip), [trip]);
  const currentDate = exploreDays.some(day => day.date === selectedDate)
    ? selectedDate
    : exploreDays[0]?.date;
  const { mapPlaces: dayPlanMapPlaces, routes: dayPlanRoutes } = useDayPlanMap({
    date: currentDate,
    trip,
  });
  const updateVisibleMapPlaceIds = React.useCallback((placeIds: string[]) => {
    setVisibleMapPlaceIds(current => (haveSamePlaceIds(current, placeIds) ? current : placeIds));
  }, []);
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
        category: place.category,
        lat: place.lat,
        lng: place.lng,
        provider: 'GOOGLE',
        providerPlaceId: place.providerPlaceId,
      }),
  );
  const { mutation: locationPlaceMutation } = useTripMutation(
    trip?.id ?? '',
    ({
      placeId,
      segmentId,
      assigned,
    }: {
      placeId: string;
      segmentId: string;
      assigned: boolean;
    }) =>
      assigned
        ? removePlaceFromSegment(trip!.id, segmentId, placeId)
        : assignPlaceToSegment(trip!.id, segmentId, placeId),
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
      <Screen>
        <EmptyState
          title="No trip selected"
          detail="Choose a trip to explore places around it."
          action={<Button onPress={() => router.push('/trip-form')}>Create trip</Button>}
        />
      </Screen>
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

  function showGooglePlace(place: GooglePlaceSearchResult) {
    setSelectedPlace(toMapPlace(place));
    if (!place.providerPlaceId) return;
    router.push({ pathname: '/place-actions', params: { googlePlaceId: place.providerPlaceId } });
  }

  return (
    <>
      <View style={{ backgroundColor: colors.background, flex: 1 }}>
        <TripMap
          fitToPlaces
          onSelectPlace={showMapPlace}
          onVisiblePlacesChange={updateVisibleMapPlaceIds}
          places={dayPlanMapPlaces}
          routes={dayPlanRoutes}
          selectedPlace={selectedPlace}
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
                  style={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: 8,
                    paddingVertical: 8,
                  }}
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
                <View
                  key={place.id}
                  style={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: 10,
                    paddingVertical: 7,
                  }}
                >
                  <Pressable
                    accessibilityHint="Centers this place on the map and opens its details"
                    accessibilityLabel={`Show ${place.name} details`}
                    accessibilityRole="button"
                    onPress={() => showGooglePlace(place)}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      flex: 1,
                      flexDirection: 'row',
                      gap: 10,
                      opacity: pressed ? 0.72 : 1,
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
                  </Pressable>
                  <Button
                    disabled={!isOnline || savePlaceMutation.isPending}
                    onPress={() => void savePlaceMutation.mutateAsync(place)}
                    tone="secondary"
                  >
                    Save
                  </Button>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
        {savedPlacesVisible ? (
          <SavedPlacesDrawer
            onClose={() => setSavedPlacesVisible(false)}
            isLocationMutationPending={locationPlaceMutation.isPending}
            isOnline={isOnline}
            locationMessage={locationMessage}
            locationScopeId={locationScopeId}
            locationSegments={trip.locationSegments}
            onLocationScopeChange={setLocationScopeId}
            onSelectPlace={showSavedPlace}
            onToggleLocationPlace={(place, segmentId, assigned) => {
              setLocationMessage(null);
              void locationPlaceMutation
                .mutateAsync({
                  placeId: place.id,
                  segmentId,
                  assigned,
                })
                .catch(error =>
                  setLocationMessage(messageFromError(error, 'Could not update this shortlist.')),
                );
            }}
            places={trip.places}
            selectedPlaceId={selectedPlace?.id}
            visiblePlaceIds={visibleMapPlaceIds}
            visible
          />
        ) : null}
        {exploreDays.length ? (
          <View
            style={{
              paddingVertical: 8,
              position: 'absolute',
              top: 175,
              width: '100%',
              zIndex: 2,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {exploreDays.map(day => (
                <Button
                  accessibilityLabel={`Show ${day.label}, ${day.shortDate} on the map`}
                  accessibilityState={{ selected: day.date === currentDate }}
                  key={day.id}
                  onPress={() => {
                    setSelectedDate(day.date);
                    setSelectedPlace(null);
                  }}
                  tone={day.date === currentDate ? 'primary' : 'secondary'}
                >
                  {day.shortDate}
                </Button>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
      <Stack.SearchBar
        autoCapitalize="none"
        barTintColor={colors.surface}
        hideNavigationBar={false}
        onCancelButtonPress={() => setQuery('')}
        onChangeText={event => setQuery(event.nativeEvent.text)}
        obscureBackground={false}
        placeholder={searchPlaceholder}
        placement="stacked"
        textColor={colors.text}
        tintColor={colors.accent}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Import a Google Maps list"
          icon={process.env.EXPO_OS === 'ios' ? 'square.and.arrow.down' : ImportIcon}
          onPress={() => router.push('/place-import')}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={`Open ${trip.places.length} saved places`}
          icon={process.env.EXPO_OS === 'ios' ? 'list.bullet' : SavedPlacesIcon}
          onPress={() => setSavedPlacesVisible(true)}
        />
      </Stack.Toolbar>
    </>
  );
}
