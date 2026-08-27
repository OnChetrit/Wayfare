import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import {
  createPlace,
  deletePlace,
  getGooglePlace,
  updatePlace,
  type GooglePlaceSearchResult,
} from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { formatDate, messageFromError } from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function PlaceActionsSheet() {
  useTheme();
  const { googlePlaceId: rawGooglePlaceId, placeId: rawPlaceId } = useLocalSearchParams<{
    googlePlaceId?: string | string[];
    placeId?: string | string[];
  }>();
  const placeId = first(rawPlaceId);
  const requestedGooglePlaceId = first(rawGooglePlaceId);
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
  const savedPlace = trip?.places.find(candidate => candidate.id === placeId);
  const googlePlaceId = requestedGooglePlaceId ?? savedPlace?.providerPlaceId;
  const googlePlaceQuery = useQuery({
    queryKey: ['google-place', googlePlaceId],
    queryFn: ({ signal }) => getGooglePlace(googlePlaceId!, signal),
    enabled: Boolean(googlePlaceId),
    staleTime: 5 * 60_000,
  });

  if (tripQuery.isLoading) return <LoadingState label="Loading place…" />;
  if (tripQuery.error) {
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }
  if (!trip) {
    return (
      <EmptyState
        title="No trip selected"
        detail="Choose a trip before viewing places."
        action={<Button onPress={() => router.replace('/trip-form')}>Create trip</Button>}
      />
    );
  }
  if (!savedPlace && !googlePlaceId) {
    return (
      <EmptyState
        title="Place not found"
        detail="Return to Explore and choose a saved place or Google result."
        action={<Button onPress={() => router.back()}>Done</Button>}
      />
    );
  }
  if (!savedPlace && googlePlaceQuery.isLoading)
    return <LoadingState label="Loading place details…" />;
  if (!savedPlace && googlePlaceQuery.error) {
    return (
      <ErrorState
        message={messageFromError(googlePlaceQuery.error, 'Could not load this Google place.')}
        onRetry={() => void googlePlaceQuery.refetch()}
      />
    );
  }

  const place = googlePlaceQuery.data ?? savedPlace;
  if (!place) {
    return (
      <EmptyState
        title="Place not found"
        detail="Google Maps did not return usable place details."
        action={<Button onPress={() => router.back()}>Done</Button>}
      />
    );
  }

  return <PlaceDetails place={place} savedPlaceId={savedPlace?.id} tripId={trip.id} />;
}

function PlaceDetails({
  place,
  savedPlaceId: initialSavedPlaceId,
  tripId,
}: {
  place: GooglePlaceSearchResult;
  savedPlaceId?: string;
  tripId: string;
}) {
  const tripQuery = useTripEditor();
  const [savedPlaceId, setSavedPlaceId] = React.useState(initialSavedPlaceId);
  const storedPlace = tripQuery.data?.places.find(candidate => candidate.id === savedPlaceId);
  const activeSavedPlaceId = storedPlace?.id ?? savedPlaceId;
  const [comment, setComment] = React.useState(storedPlace?.comment ?? '');
  const [message, setMessage] = React.useState<string | null>(null);
  const { isOnline, mutation: savePlaceMutation } = useTripMutation(tripId, () =>
    createPlace(tripId, {
      name: place.name,
      category: place.category,
      lat: place.lat,
      lng: place.lng,
      provider: 'GOOGLE',
      providerPlaceId: place.providerPlaceId,
    }),
  );
  const { mutation: favoriteMutation } = useTripMutation(tripId, () => {
    if (!activeSavedPlaceId) throw new Error('Save this place before updating it.');
    return updatePlace(tripId, activeSavedPlaceId, { isFavorite: !storedPlace?.isFavorite });
  });
  const { mutation: commentMutation } = useTripMutation(tripId, () => {
    if (!activeSavedPlaceId) throw new Error('Save this place before adding a comment.');
    return updatePlace(tripId, activeSavedPlaceId, { comment });
  });
  const { mutation: deleteMutation } = useTripMutation(tripId, () => {
    if (!activeSavedPlaceId) throw new Error('Saved place not found.');
    return deletePlace(tripId, activeSavedPlaceId);
  });

  async function savePlace() {
    setMessage(null);
    try {
      const result = await savePlaceMutation.mutateAsync(undefined);
      setSavedPlaceId(result.place.id);
      await tripQuery.refetch();
    } catch (error) {
      setMessage(messageFromError(error, 'Could not save this place.'));
    }
  }

  async function toggleFavorite() {
    setMessage(null);
    try {
      await favoriteMutation.mutateAsync(undefined);
    } catch (error) {
      setMessage(messageFromError(error, 'Could not update this favorite.'));
    }
  }

  async function saveComment() {
    setMessage(null);
    try {
      await commentMutation.mutateAsync(undefined);
    } catch (error) {
      setMessage(messageFromError(error, 'Could not save this comment.'));
    }
  }

  function addToDay(date: string) {
    if (!activeSavedPlaceId) return;
    router.replace({
      pathname: '/itinerary-editor',
      params: { date, kind: 'schedule', savedPlaceId: activeSavedPlaceId },
    });
  }

  function confirmDelete() {
    Alert.alert(
      `Delete ${place.name}?`,
      'This removes it from saved places and from any itinerary items that reference it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete place',
          style: 'destructive',
          onPress: () =>
            void deleteMutation
              .mutateAsync(undefined)
              .then(() => router.back())
              .catch(error => setMessage(messageFromError(error, 'Could not delete this place.'))),
        },
      ],
    );
  }

  function openUrl(url: string) {
    void Linking.openURL(url).catch(error => {
      setMessage(messageFromError(error, 'Could not open this link.'));
    });
  }

  const photos = place.photos ?? [];
  const attributions = photos.flatMap(photo => photo.attributions);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <OfflineNotice visible={!isOnline} />
      <View style={{ gap: 3 }}>
        <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
          {place.emoji} {place.name}
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          {place.subtitle}
        </Text>
        {place.rating != null ? (
          <Text selectable style={{ color: colors.accent, fontSize: 15, fontWeight: '800' }}>
            ★ {place.rating.toFixed(1)} on Google Maps
          </Text>
        ) : null}
      </View>

      {photos.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {photos.map((photo, index) => (
            <Image
              contentFit="cover"
              key={`${photo.url}-${index}`}
              source={{ uri: photo.url }}
              style={{ borderRadius: 14, height: 180, width: 260 }}
            />
          ))}
        </ScrollView>
      ) : null}

      {attributions.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            Photo credits:
          </Text>
          {attributions.map((attribution, index) =>
            attribution.uri ? (
              <Pressable
                accessibilityLabel={`Open photo credit for ${attribution.name}`}
                accessibilityRole="link"
                key={`${attribution.name}-${index}`}
                onPress={() => openUrl(attribution.uri!)}
              >
                <Text selectable style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
                  {attribution.name}
                </Text>
              </Pressable>
            ) : (
              <Text
                key={`${attribution.name}-${index}`}
                selectable
                style={{ color: colors.textMuted, fontSize: 13 }}
              >
                {attribution.name}
              </Text>
            ),
          )}
        </View>
      ) : null}

      {place.googleMapsUri ? (
        <Button onPress={() => openUrl(place.googleMapsUri!)} tone="secondary">
          Open in Google Maps
        </Button>
      ) : null}

      {!activeSavedPlaceId ? (
        <Button
          disabled={!isOnline}
          loading={savePlaceMutation.isPending}
          onPress={() => void savePlace()}
        >
          Save to trip
        </Button>
      ) : (
        <>
          <Button
            accessibilityLabel={`${storedPlace?.isFavorite ? 'Remove' : 'Add'} ${place.name} ${
              storedPlace?.isFavorite ? 'from' : 'to'
            } favorites`}
            accessibilityState={{ selected: Boolean(storedPlace?.isFavorite) }}
            disabled={!isOnline || favoriteMutation.isPending}
            loading={favoriteMutation.isPending}
            onPress={() => void toggleFavorite()}
            tone={storedPlace?.isFavorite ? 'primary' : 'secondary'}
          >
            {storedPlace?.isFavorite ? 'In favorites' : 'Add to favorites'}
          </Button>
          <Field
            accessibilityLabel="Place comment"
            label="Your comment"
            multiline
            onChangeText={setComment}
            placeholder="Reservations, tips, or reminders"
            value={comment}
          />
          <Button
            disabled={!isOnline || commentMutation.isPending}
            loading={commentMutation.isPending}
            onPress={() => void saveComment()}
            tone="secondary"
          >
            Save comment
          </Button>
          <View style={{ gap: 5 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
              Add to a trip day
            </Text>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
              Choose a date, then set the visit time and details.
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {tripQuery.data?.days.map(day => (
              <Button
                accessibilityLabel={`Add ${place.name} to ${day.label}, ${formatDate(day.date)}`}
                disabled={!isOnline}
                key={day.id}
                onPress={() => addToDay(day.date)}
                style={{ justifyContent: 'flex-start' }}
                tone="secondary"
              >
                <View style={{ gap: 1 }}>
                  <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                    {day.label}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                    {formatDate(day.date, { weekday: 'long' })}
                  </Text>
                </View>
              </Button>
            ))}
          </View>
          <Button
            disabled={!isOnline || deleteMutation.isPending}
            loading={deleteMutation.isPending}
            onPress={confirmDelete}
            tone="danger"
          >
            Delete saved place
          </Button>
        </>
      )}

      {message ? (
        <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}
