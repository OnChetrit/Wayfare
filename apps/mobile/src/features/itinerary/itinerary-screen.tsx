import AddIcon from '@expo/material-symbols/add.xml';
import {
  Button as SwiftButton,
  Host,
  HStack,
  List,
  Section,
  ScrollView as SwiftScrollView,
  Spacer,
  Text as SwiftText,
  VStack,
} from '@expo/ui/swift-ui';
import { buttonStyle, disabled, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Link, router, Stack } from 'expo-router';
import * as React from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';

import { deleteFlight, deleteSchedule, deleteStay, updateSchedule } from '@/api/trips';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, EmptyState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { Screen } from '@/components/ui/screen';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { useTrips } from '@/features/trips/trip-context';
import { formatDate, formatDateRange, formatDuration, messageFromError } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

function entryTitle(
  item: { savedPlaceId: string | null; title?: string },
  places: { id: string; name: string }[],
) {
  return places.find(place => place.id === item.savedPlaceId)?.name ?? item.title ?? 'Activity';
}

export function ItineraryScreen() {
  const { selectedTrip } = useTrips();
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const { isOnline, mutation: deleteScheduleMutation } = useTripMutation(
    trip?.id ?? '',
    (scheduleId: string) => deleteSchedule(trip!.id, scheduleId),
  );
  const { mutation: deleteStayMutation } = useTripMutation(trip?.id ?? '', (stayId: string) =>
    deleteStay(trip!.id, stayId),
  );
  const { mutation: deleteFlightMutation } = useTripMutation(trip?.id ?? '', (flightId: string) =>
    deleteFlight(trip!.id, flightId),
  );
  const { mutation: reorderMutation } = useTripMutation(
    trip?.id ?? '',
    ({
      id,
      date,
      startTime,
      sortOrder,
    }: {
      id: string;
      date: string;
      startTime: string;
      sortOrder: number;
    }) => updateSchedule(trip!.id, id, { date, startTime, sortOrder }),
  );

  if (!selectedTrip && !tripQuery.isLoading) {
    return (
      <Screen>
        <EmptyState
          title="Choose a trip to start planning"
          detail="Trips you create or join will appear here."
        />
      </Screen>
    );
  }
  if (tripQuery.isLoading) return <LoadingState label="Loading your itinerary…" />;
  if (tripQuery.error) {
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }
  if (!trip) return null;

  const currentDate = trip.days.some(day => day.date === selectedDate)
    ? selectedDate
    : trip.days[0]?.date;
  if (!currentDate) return null;

  const selectedDay = trip.days.find(day => day.date === currentDate) ?? trip.days[0];
  const timeline = trip.schedule
    .filter(item => item.date === selectedDay.date)
    .sort(
      (a, b) => a.startTime.localeCompare(b.startTime) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  const stays = trip.stays.filter(
    stay => stay.checkInDate <= selectedDay.date && stay.checkOutDate >= selectedDay.date,
  );
  const flights = trip.flights.filter(flight => flight.departureDate === selectedDay.date);

  function confirmDelete(label: string, onConfirm: () => void) {
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }

  function moveItem(index: number, direction: -1 | 1) {
    const next = timeline[index + direction];
    const current = timeline[index];
    if (!next || !current) return;
    void Promise.all([
      reorderMutation.mutateAsync({
        id: current.id,
        date: current.date,
        startTime: current.startTime,
        sortOrder: next.sortOrder ?? index + direction,
      }),
      reorderMutation.mutateAsync({
        id: next.id,
        date: next.date,
        startTime: next.startTime,
        sortOrder: current.sortOrder ?? index,
      }),
    ]).catch(() => undefined);
  }

  if (process.env.EXPO_OS === 'ios') {
    return (
      <>
        <Host colorScheme="dark" seedColor={colors.accent} style={{ flex: 1 }}>
          <List
            modifiers={[
              listStyle('plain'),
              refreshable(async () => {
                await tripQuery.refetch();
              }),
            ]}
          >
            {!isOnline ? (
              <Section title="Connection">
                <SwiftText>You’re offline. Reconnect to update your itinerary.</SwiftText>
              </Section>
            ) : null}
            <Section title={trip.name}>
              <SwiftText>{formatDateRange(trip.startDate, trip.endDate)}</SwiftText>
            </Section>
            <Section title="Days">
              <SwiftScrollView axes="horizontal" showsIndicators={false}>
                <HStack spacing={8}>
                  {trip.days.map(day => (
                    <SwiftButton
                      key={day.id}
                      label={`${day.label} · ${day.shortDate}`}
                      modifiers={[
                        buttonStyle(
                          day.date === selectedDay.date ? 'borderedProminent' : 'bordered',
                        ),
                      ]}
                      onPress={() => setSelectedDate(day.date)}
                    />
                  ))}
                </HStack>
              </SwiftScrollView>
            </Section>
            <Section
              title={`${selectedDay.label} · ${formatDate(selectedDay.date, {
                weekday: 'long',
                month: 'long',
              })}`}
            >
              {selectedDay.notes ? <SwiftText>{selectedDay.notes}</SwiftText> : null}
              {timeline.length ? (
                timeline.map((item, index) => (
                  <VStack alignment="leading" key={item.id} spacing={8}>
                    <SwiftButton
                      modifiers={[buttonStyle('plain')]}
                      onPress={() =>
                        router.push({
                          pathname: '/itinerary-editor',
                          params: { kind: 'schedule', id: item.id, date: item.date },
                        })
                      }
                    >
                      <HStack spacing={12}>
                        <SwiftText>{item.startTime}</SwiftText>
                        <VStack alignment="leading" spacing={3}>
                          <SwiftText>{entryTitle(item, trip.places)}</SwiftText>
                          <SwiftText>
                            {formatDuration(item.duration)}
                            {item.note ? ` · ${item.note}` : ''}
                          </SwiftText>
                        </VStack>
                        <Spacer />
                        <SwiftText>›</SwiftText>
                      </HStack>
                    </SwiftButton>
                    <HStack spacing={8}>
                      <SwiftButton
                        label="Earlier"
                        modifiers={[
                          buttonStyle('bordered'),
                          disabled(!isOnline || index === 0 || reorderMutation.isPending),
                        ]}
                        onPress={() => moveItem(index, -1)}
                      />
                      <SwiftButton
                        label="Later"
                        modifiers={[
                          buttonStyle('bordered'),
                          disabled(
                            !isOnline || index === timeline.length - 1 || reorderMutation.isPending,
                          ),
                        ]}
                        onPress={() => moveItem(index, 1)}
                      />
                      <SwiftButton
                        label="Delete"
                        modifiers={[
                          buttonStyle('bordered'),
                          disabled(!isOnline || deleteScheduleMutation.isPending),
                        ]}
                        onPress={() =>
                          confirmDelete('this item', () => deleteScheduleMutation.mutate(item.id))
                        }
                        role="destructive"
                      />
                    </HStack>
                  </VStack>
                ))
              ) : (
                <VStack alignment="leading" spacing={4}>
                  <SwiftText>Nothing planned yet</SwiftText>
                  <SwiftText>Add a saved place or a custom activity to build this day.</SwiftText>
                </VStack>
              )}
            </Section>
            {stays.length ? (
              <Section title="Stays">
                {stays.map(stay => (
                  <VStack alignment="leading" key={stay.id} spacing={8}>
                    <SwiftButton
                      modifiers={[buttonStyle('plain')]}
                      onPress={() =>
                        router.push({
                          pathname: '/itinerary-editor',
                          params: { kind: 'stay', id: stay.id },
                        })
                      }
                    >
                      <VStack alignment="leading" spacing={3}>
                        <SwiftText>Stay · {stay.name}</SwiftText>
                        <SwiftText>
                          {stay.checkInDate} – {stay.checkOutDate}
                        </SwiftText>
                      </VStack>
                    </SwiftButton>
                    <SwiftButton
                      label="Delete"
                      modifiers={[
                        buttonStyle('bordered'),
                        disabled(!isOnline || deleteStayMutation.isPending),
                      ]}
                      onPress={() =>
                        confirmDelete('this stay', () => deleteStayMutation.mutate(stay.id))
                      }
                      role="destructive"
                    />
                  </VStack>
                ))}
              </Section>
            ) : null}
            {flights.length ? (
              <Section title="Flights">
                {flights.map(flight => (
                  <VStack alignment="leading" key={flight.id} spacing={8}>
                    <VStack alignment="leading" spacing={3}>
                      <SwiftText>Flight · {flight.flightNumber}</SwiftText>
                      <SwiftText>
                        {flight.scheduledDepartureLocal} · {flight.status}
                      </SwiftText>
                    </VStack>
                    <SwiftButton
                      label="Delete"
                      modifiers={[
                        buttonStyle('bordered'),
                        disabled(!isOnline || deleteFlightMutation.isPending),
                      ]}
                      onPress={() =>
                        confirmDelete('this flight', () => deleteFlightMutation.mutate(flight.id))
                      }
                      role="destructive"
                    />
                  </VStack>
                ))}
              </Section>
            ) : null}
            <Section title="Trip details">
              <SwiftButton
                label="Day note"
                onPress={() =>
                  router.push({
                    pathname: '/itinerary-editor',
                    params: { kind: 'day', id: selectedDay.id },
                  })
                }
              />
              <SwiftButton
                label={`Stays (${trip.stays.length})`}
                onPress={() =>
                  router.push({ pathname: '/itinerary-editor', params: { kind: 'stays' } })
                }
              />
              <SwiftButton
                label={`Flights (${trip.flights.length})`}
                onPress={() =>
                  router.push({
                    pathname: '/itinerary-editor',
                    params: { kind: 'flights', date: selectedDay.date },
                  })
                }
              />
              <SwiftButton
                label={`Locations (${trip.locationSegments.length})`}
                onPress={() =>
                  router.push({ pathname: '/itinerary-editor', params: { kind: 'locations' } })
                }
              />
            </Section>
          </List>
        </Host>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Add itinerary item"
            icon={process.env.EXPO_OS === 'ios' ? 'plus' : AddIcon}
            onPress={() =>
              router.push({
                pathname: '/itinerary-editor',
                params: { kind: 'schedule', date: selectedDay.date },
              })
            }
          />
        </Stack.Toolbar>
      </>
    );
  }

  return (
    <>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={tripQuery.isRefetching}
            onRefresh={() => void tripQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <OfflineNotice visible={!isOnline} />
        <View style={{ gap: 4 }}>
          <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
            {trip.name}
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {trip.days.map(day => (
            <Button
              key={day.id}
              accessibilityLabel={`View ${day.label}, ${day.shortDate}`}
              onPress={() => setSelectedDate(day.date)}
              style={{ minHeight: 54, minWidth: 72 }}
              tone={day.date === selectedDay.date ? 'primary' : 'secondary'}
            >
              <Text
                selectable
                style={{
                  color: day.date === selectedDay.date ? colors.accentText : colors.text,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {day.weekday}
              </Text>
              <Text
                selectable
                style={{
                  color: day.date === selectedDay.date ? colors.accentText : colors.text,
                  fontSize: 13,
                }}
              >
                {day.shortDate}
              </Text>
            </Button>
          ))}
        </ScrollView>

        <View>
          <View>
            <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
              {selectedDay.label}
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              {formatDate(selectedDay.date, { weekday: 'long', month: 'long' })}
            </Text>
          </View>
        </View>

        {selectedDay.notes ? (
          <Card>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
              {selectedDay.notes}
            </Text>
          </Card>
        ) : null}

        <View style={{ gap: space.sm }}>
          {timeline.length ? (
            timeline.map((item, index) => (
              <Card key={item.id}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
                  <Text
                    selectable
                    style={{
                      color: colors.accent,
                      fontSize: 14,
                      fontVariant: ['tabular-nums'],
                      fontWeight: '800',
                      width: 48,
                    }}
                  >
                    {item.startTime}
                  </Text>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      selectable
                      style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
                    >
                      {entryTitle(item, trip.places)}
                    </Text>
                    <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                      {formatDuration(item.duration)}
                      {item.note ? ` · ${item.note}` : ''}
                    </Text>
                  </View>
                  <Link
                    href={{
                      pathname: '/itinerary-editor',
                      params: { kind: 'schedule', id: item.id, date: item.date },
                    }}
                    asChild
                  >
                    <IconButton label={`Edit ${entryTitle(item, trip.places)}`}>Edit</IconButton>
                  </Link>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <IconButton
                    disabled={!isOnline || index === 0 || reorderMutation.isPending}
                    label="Move item earlier"
                    onPress={() => moveItem(index, -1)}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    disabled={
                      !isOnline || index === timeline.length - 1 || reorderMutation.isPending
                    }
                    label="Move item later"
                    onPress={() => moveItem(index, 1)}
                  >
                    ↓
                  </IconButton>
                  <Button
                    disabled={!isOnline || deleteScheduleMutation.isPending}
                    onPress={() =>
                      confirmDelete('this item', () => deleteScheduleMutation.mutate(item.id))
                    }
                    tone="danger"
                  >
                    Delete
                  </Button>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              title="Nothing planned yet"
              detail="Add a saved place or a custom activity to build this day."
            />
          )}

          {stays.map(stay => (
            <Card key={stay.id}>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                Stay · {stay.name}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {stay.checkInDate} – {stay.checkOutDate}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Link
                  href={{ pathname: '/itinerary-editor', params: { kind: 'stay', id: stay.id } }}
                  asChild
                >
                  <Button tone="secondary">Edit</Button>
                </Link>
                <Button
                  disabled={!isOnline || deleteStayMutation.isPending}
                  onPress={() =>
                    confirmDelete('this stay', () => deleteStayMutation.mutate(stay.id))
                  }
                  tone="danger"
                >
                  Delete
                </Button>
              </View>
            </Card>
          ))}
          {flights.map(flight => (
            <Card key={flight.id}>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                Flight · {flight.flightNumber}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {flight.scheduledDepartureLocal} · {flight.status}
              </Text>
              <Button
                disabled={!isOnline || deleteFlightMutation.isPending}
                onPress={() =>
                  confirmDelete('this flight', () => deleteFlightMutation.mutate(flight.id))
                }
                tone="danger"
              >
                Delete
              </Button>
            </Card>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>
            Trip details
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Link
              href={{ pathname: '/itinerary-editor', params: { kind: 'day', id: selectedDay.id } }}
              asChild
            >
              <Button tone="secondary">Day note</Button>
            </Link>
            <Link href={{ pathname: '/itinerary-editor', params: { kind: 'stays' } }} asChild>
              <Button tone="secondary">Stays ({trip.stays.length})</Button>
            </Link>
            <Link
              href={{
                pathname: '/itinerary-editor',
                params: { kind: 'flights', date: selectedDay.date },
              }}
              asChild
            >
              <Button tone="secondary">Flights ({trip.flights.length})</Button>
            </Link>
            <Link href={{ pathname: '/itinerary-editor', params: { kind: 'locations' } }} asChild>
              <Button tone="secondary">Locations ({trip.locationSegments.length})</Button>
            </Link>
          </View>
        </View>
      </Screen>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Add itinerary item"
          icon={process.env.EXPO_OS === 'ios' ? 'plus' : AddIcon}
          onPress={() =>
            router.push({
              pathname: '/itinerary-editor',
              params: { kind: 'schedule', date: selectedDay.date },
            })
          }
        />
      </Stack.Toolbar>
    </>
  );
}
