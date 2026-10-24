import type { TripEditorTrip } from '@wayfare/domain';
import { router } from 'expo-router';
import * as React from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { useIsOnline } from '@/api/query-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useAuth } from '@/features/auth/auth-context';
import { dayItineraryEntries, type DayItineraryEntry } from '@/features/itinerary/day-itinerary';
import { flightEventDetail, flightRoute } from '@/features/itinerary/flight-details';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { useTrips } from '@/features/trips/trip-context';
import {
  formatDate,
  formatDateRange,
  formatDuration,
  formatMoney,
  messageFromError,
} from '@/lib/format';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

import { closestTripDay } from './overview-day';
import {
  moveOverviewCard,
  overviewLayoutFromMetadata,
  overviewMetadataUpdate,
  type OverviewCardId,
  type OverviewLayout,
} from './overview-layout';
import { overviewEntryTarget } from './overview-navigation';

function entryCopy(entry: DayItineraryEntry, trip: TripEditorTrip) {
  if (entry.kind === 'schedule') {
    const place = trip.places.find(place => place.id === entry.item.savedPlaceId);
    return {
      label: 'ACTIVITY',
      title: place?.name ?? entry.item.title ?? 'Activity',
      detail: [
        formatDuration(entry.item.duration),
        entry.item.amount != null && entry.item.currency
          ? formatMoney(entry.item.amount, entry.item.currency)
          : null,
        entry.item.note,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  }
  if (entry.kind === 'flight') {
    return {
      label: 'FLIGHT',
      title: `${entry.event === 'arrival' ? 'Arrive' : 'Depart'} · ${flightRoute(entry.flight)}`,
      detail: flightEventDetail(entry.flight, entry.event),
    };
  }
  return {
    label: 'STAY',
    title: `${entry.event === 'check-in' ? 'Check in' : entry.event === 'check-out' ? 'Check out' : 'Stay'} · ${entry.stay.name}`,
    detail: [
      formatDateRange(entry.stay.checkInDate, entry.stay.checkOutDate),
      entry.stay.locationLabel ?? entry.stay.address,
      entry.stay.notes,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

export function OverviewScreen() {
  const { colors } = useTheme();
  const { session, updateUserMetadata } = useAuth();
  const { trips, selectedTrip, isLoadingTrips, selectTrip, selectTripDay } = useTrips();
  const tripQuery = useTripEditor();
  const isOnline = useIsOnline();
  const [showTrips, setShowTrips] = React.useState(false);
  const [editingCards, setEditingCards] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => new Date());
  const layout = overviewLayoutFromMetadata(session?.user.user_metadata);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  async function saveLayout(next: OverviewLayout) {
    if (!session || !isOnline || saving) return;
    setSaving(true);
    setMessage(null);
    const error = await updateUserMetadata(
      overviewMetadataUpdate(session.user.user_metadata, next),
    );
    setSaving(false);
    if (error) setMessage(error.message);
  }

  function openPlan(date: string) {
    selectTripDay(date);
    router.push('/plan');
  }

  if (isLoadingTrips || (selectedTrip && tripQuery.isLoading)) {
    return <LoadingState label="Loading your overview…" />;
  }
  if (!selectedTrip) {
    return (
      <Screen>
        <EmptyState
          title="Your next trip starts here"
          detail="Create a trip to see its day plan and essentials."
          action={<Button onPress={() => router.push('/trip-form')}>Create trip</Button>}
        />
      </Screen>
    );
  }
  if (tripQuery.error) {
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }
  const trip = tripQuery.data;
  if (!trip) return null;
  const day = closestTripDay(trip.days, trip.defaultTimeZone, now);
  const entries = day ? dayItineraryEntries(trip.schedule, trip.flights, trip.stays, day.date) : [];
  const cardDetails: Record<OverviewCardId, { title: string; detail: string; open: () => void }> = {
    locations: {
      title: 'Locations',
      detail: `${trip.locationSegments.length} locations`,
      open: () => router.push({ pathname: '/itinerary-editor', params: { kind: 'locations' } }),
    },
    'flights-stays': {
      title: 'Flights & stays',
      detail: `${trip.flights.length} flights · ${trip.stays.length} stays`,
      open: () => router.push({ pathname: '/itinerary-editor', params: { kind: 'flights' } }),
    },
    expenses: {
      title: 'Expenses',
      detail: `${trip.expenses.length} expenses`,
      open: () => router.push('/expenses'),
    },
    reminders: {
      title: 'Reminders',
      detail: 'Your personal reminders',
      open: () => router.push('/reminders'),
    },
  };

  return (
    <Screen>
      <OfflineNotice visible={!isOnline} />
      <Card style={{ gap: space.sm }}>
        <Text selectable style={{ color: colors.textMuted, fontWeight: '700' }}>
          YOUR TRIP
        </Text>
        <Text selectable style={{ color: colors.text, fontSize: 27, fontWeight: '800' }}>
          {trip.name}
        </Text>
        {trip.destinationLabel ? (
          <Text selectable style={{ color: colors.text }}>
            {trip.destinationLabel}
          </Text>
        ) : null}
        <Text selectable style={{ color: colors.textMuted }}>
          {formatDateRange(trip.startDate, trip.endDate)}
        </Text>
        <Button
          accessibilityLabel="Switch trip"
          onPress={() => setShowTrips(value => !value)}
          tone="secondary"
        >
          Switch trip
        </Button>
        {showTrips
          ? trips.map(option => (
              <Button
                key={option.id}
                accessibilityLabel={`Select ${option.name}`}
                accessibilityState={{ selected: option.id === trip.id }}
                disabled={!isOnline || saving}
                onPress={() => {
                  setShowTrips(false);
                  void selectTrip(option.id).catch(error => setMessage(messageFromError(error)));
                }}
                tone={option.id === trip.id ? 'primary' : 'quiet'}
              >
                {option.name}
              </Button>
            ))
          : null}
      </Card>

      {day ? (
        <Card>
          <Text selectable style={{ color: colors.textMuted, fontWeight: '700' }}>
            CLOSEST DAY
          </Text>
          <Text selectable style={{ color: colors.text, fontSize: 23, fontWeight: '800' }}>
            {day.label}
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {formatDate(day.date, { weekday: 'long', month: 'long' })}
          </Text>
          <Button
            accessibilityLabel={`Open ${day.label} in Plan`}
            onPress={() => openPlan(day.date)}
            tone="secondary"
          >
            Open day in Plan
          </Button>
          {day.notes ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open notes for ${day.label}`}
              onPress={() =>
                router.push({ pathname: '/itinerary-editor', params: { kind: 'day', id: day.id } })
              }
              style={{ minHeight: 44, paddingVertical: space.sm }}
            >
              <Text selectable style={{ color: colors.text }}>
                {day.notes}
              </Text>
            </Pressable>
          ) : null}
          {entries.length ? (
            entries.map(entry => {
              const copy = entryCopy(entry, trip);
              const target = overviewEntryTarget(entry);
              return (
                <Pressable
                  key={entry.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${copy.title}`}
                  onPress={() => router.push({ pathname: '/item-details', params: target })}
                  style={{
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    gap: 3,
                    paddingVertical: space.md,
                  }}
                >
                  <Text
                    selectable
                    style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}
                  >
                    {entry.time ?? 'Any time'} · {copy.label}
                  </Text>
                  <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                    {copy.title}
                  </Text>
                  {copy.detail ? (
                    <Text selectable style={{ color: colors.textMuted }}>
                      {copy.detail}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <View style={{ gap: space.sm, paddingVertical: space.md }}>
              <Text selectable style={{ color: colors.textMuted }}>
                Nothing planned for this day yet.
              </Text>
              <Button
                accessibilityLabel={`Add to ${day.label} in Plan`}
                onPress={() => openPlan(day.date)}
              >
                Add to this day
              </Button>
            </View>
          )}
        </Card>
      ) : null}

      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
          Trip essentials
        </Text>
        <Button
          accessibilityLabel={editingCards ? 'Done customizing cards' : 'Customize cards'}
          onPress={() => setEditingCards(value => !value)}
          tone="quiet"
        >
          {editingCards ? 'Done' : 'Customize'}
        </Button>
      </View>
      {layout.order.map((id, index) => {
        const card = cardDetails[id];
        const hidden = layout.hidden.includes(id);
        if (hidden && !editingCards) return null;
        return (
          <Card key={id} style={{ opacity: hidden ? 0.55 : 1 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
              {card.title}
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              {card.detail}
            </Text>
            {id === 'flights-stays' && !editingCards ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button onPress={card.open} style={{ flex: 1 }} tone="secondary">
                  Flights
                </Button>
                <Button
                  onPress={() =>
                    router.push({ pathname: '/itinerary-editor', params: { kind: 'stays' } })
                  }
                  style={{ flex: 1 }}
                  tone="secondary"
                >
                  Stays
                </Button>
              </View>
            ) : !editingCards ? (
              <Button onPress={card.open} tone="secondary">
                Open {card.title}
              </Button>
            ) : null}
            {editingCards ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                <Button
                  accessibilityLabel={`Move ${card.title} up`}
                  disabled={!isOnline || saving || index === 0}
                  onPress={() =>
                    void saveLayout({ ...layout, order: moveOverviewCard(layout.order, id, -1) })
                  }
                  tone="secondary"
                >
                  Up
                </Button>
                <Button
                  accessibilityLabel={`Move ${card.title} down`}
                  disabled={!isOnline || saving || index === layout.order.length - 1}
                  onPress={() =>
                    void saveLayout({ ...layout, order: moveOverviewCard(layout.order, id, 1) })
                  }
                  tone="secondary"
                >
                  Down
                </Button>
                <Button
                  accessibilityLabel={`${hidden ? 'Show' : 'Hide'} ${card.title}`}
                  disabled={!isOnline || saving}
                  onPress={() =>
                    void saveLayout({
                      ...layout,
                      hidden: hidden
                        ? layout.hidden.filter(value => value !== id)
                        : [...layout.hidden, id],
                    })
                  }
                  tone="secondary"
                >
                  {hidden ? 'Show' : 'Hide'}
                </Button>
              </View>
            ) : null}
          </Card>
        );
      })}
      {message ? (
        <Text selectable style={{ color: colors.danger }}>
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}
