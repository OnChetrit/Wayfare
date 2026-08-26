import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { updatePlace } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { formatDate, messageFromError } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function PlaceActionsSheet() {
  const { placeId: rawPlaceId } = useLocalSearchParams<{ placeId?: string | string[] }>();
  const placeId = first(rawPlaceId);
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
  const place = trip?.places.find(candidate => candidate.id === placeId);
  const [message, setMessage] = React.useState<string | null>(null);
  const { isOnline, mutation: favoriteMutation } = useTripMutation(trip?.id ?? '', () =>
    updatePlace(trip!.id, place!.id, { isFavorite: !place!.isFavorite }),
  );

  if (tripQuery.isLoading) return <LoadingState label="Loading place…" />;
  if (tripQuery.error) {
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }
  if (!trip || !place) {
    return (
      <EmptyState
        title="Saved place not found"
        detail="Return to Explore and choose a place from your saved list."
        action={<Button onPress={() => router.back()}>Done</Button>}
      />
    );
  }
  const selectedPlaceId = place.id;

  async function toggleFavorite() {
    setMessage(null);
    try {
      await favoriteMutation.mutateAsync(undefined);
    } catch (error) {
      setMessage(messageFromError(error, 'Could not update this favorite.'));
    }
  }

  function addToDay(date: string) {
    router.replace({
      pathname: '/itinerary-editor',
      params: { date, kind: 'schedule', savedPlaceId: selectedPlaceId },
    });
  }

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
      </View>
      <Button
        accessibilityLabel={`${place.isFavorite ? 'Remove' : 'Add'} ${place.name} ${
          place.isFavorite ? 'from' : 'to'
        } favorites`}
        accessibilityState={{ selected: Boolean(place.isFavorite) }}
        disabled={!isOnline}
        loading={favoriteMutation.isPending}
        onPress={() => void toggleFavorite()}
        tone={place.isFavorite ? 'primary' : 'secondary'}
      >
        {place.isFavorite ? 'In favorites' : 'Add to favorites'}
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
        {trip.days.map(day => (
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
      {message ? (
        <Text selectable style={{ color: colors.danger }}>
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}
