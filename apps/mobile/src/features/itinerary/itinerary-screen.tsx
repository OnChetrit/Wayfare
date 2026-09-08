import AddIcon from '@expo/material-symbols/add.xml';
import {
  Button as SwiftButton,
  Host,
  HStack,
  Label,
  List,
  Section,
  ScrollView as SwiftScrollView,
  Spacer,
  SwipeActions,
  Text as SwiftText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled,
  foregroundStyle,
  listStyle,
  refreshable,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { orderScheduleItemsForDay } from '@wayfare/domain';
import { Link, router, Stack } from 'expo-router';
import * as React from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';

import { deleteFlight, deleteSchedule, deleteStay, updateSchedule } from '@/api/trips';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, EmptyState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { Screen } from '@/components/ui/screen';
import { dayItineraryEntries, type DayItineraryEntry } from '@/features/itinerary/day-itinerary';
import { flightEventDetail, flightRoute } from '@/features/itinerary/flight-details';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { useTrips } from '@/features/trips/trip-context';
import {
  formatDate,
  formatDateRange,
  formatDuration,
  formatMoney,
  messageFromError,
} from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

function entryTitle(
  item: { savedPlaceId: string | null; title?: string },
  places: { id: string; name: string }[],
) {
  return places.find(place => place.id === item.savedPlaceId)?.name ?? item.title ?? 'Activity';
}

function itineraryEntryTone(kind: DayItineraryEntry['kind'], theme: 'light' | 'dark') {
  if (kind === 'schedule') return theme === 'light' ? '#17795d' : '#4ab58b';
  if (kind === 'flight') return theme === 'light' ? '#39799b' : '#7bb9dc';
  return theme === 'light' ? '#81549d' : '#c39ae0';
}

function itineraryEntrySurface(tone: string, theme: 'light' | 'dark') {
  return `${tone}${theme === 'light' ? '0D' : '1A'}`;
}

function stayEventTitle(event: Extract<DayItineraryEntry, { kind: 'stay' }>['event']) {
  if (event === 'check-in') return 'Check in';
  if (event === 'check-out') return 'Check out';
  return 'Stay';
}

export function ItineraryScreen() {
  const { theme } = useTheme();
  const { selectedTrip, selectedTripDayDate, selectTripDay } = useTrips();
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
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
      startTime: string | null;
      sortOrder: number;
    }) => updateSchedule(trip!.id, id, { date, startTime, sortOrder }),
  );

  if (!selectedTrip && !tripQuery.isLoading) {
    return (
      <Screen>
        <EmptyState
          title="Choose a trip to start planning"
          detail="Trips you create or join will appear here."
          action={<Button onPress={() => router.push('/trip-form')}>Create trip</Button>}
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

  const currentDate =
    selectedTripDayDate && trip.days.some(day => day.date === selectedTripDayDate)
      ? selectedTripDayDate
      : trip.days[0]?.date;
  if (!currentDate) return null;

  const selectedDay = trip.days.find(day => day.date === currentDate) ?? trip.days[0];
  const timeline = orderScheduleItemsForDay(trip.schedule, selectedDay.date);
  const dayEntries = dayItineraryEntries(trip.schedule, trip.flights, trip.stays, selectedDay.date);

  function confirmDelete(label: string, onConfirm: () => void) {
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }

  function moveItem(index: number, direction: -1 | 1) {
    const next = timeline[index + direction];
    const current = timeline[index];
    if (!next || !current || current.sortOrder === undefined || next.sortOrder === undefined)
      return;
    void Promise.all([
      reorderMutation.mutateAsync({
        id: current.id,
        date: current.date,
        startTime: current.startTime,
        sortOrder: next.sortOrder,
      }),
      reorderMutation.mutateAsync({
        id: next.id,
        date: next.date,
        startTime: next.startTime,
        sortOrder: current.sortOrder,
      }),
    ]).catch(() => undefined);
  }

  if (process.env.EXPO_OS === 'ios') {
    return (
      <>
        <Host colorScheme={theme} seedColor={colors.accent} style={{ flex: 1 }}>
          <List
            modifiers={[
              listStyle('insetGrouped'),
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
                      onPress={() => selectTripDay(day.date)}
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
              {dayEntries.length ? (
                dayEntries.map(entry => {
                  const tone = itineraryEntryTone(entry.kind, theme);

                  if (entry.kind === 'schedule') {
                    const { item, scheduleIndex } = entry;
                    return (
                      <SwipeActions key={entry.key} modifiers={[tag(entry.key)]}>
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
                            <Label
                              title={entryTitle(item, trip.places)}
                              systemImage="circle.fill"
                              modifiers={[foregroundStyle(tone)]}
                            />
                            <VStack alignment="leading" spacing={3}>
                              {entry.time ? (
                                <SwiftText modifiers={[foregroundStyle(tone)]}>
                                  {entry.time}
                                </SwiftText>
                              ) : null}
                              <SwiftText>
                                {formatDuration(item.duration)}
                                {item.amount != null && item.currency
                                  ? ` · ${formatMoney(item.amount, item.currency)}`
                                  : ''}
                                {item.note ? ` · ${item.note}` : ''}
                              </SwiftText>
                            </VStack>
                            <Spacer />
                            <SwiftText>›</SwiftText>
                          </HStack>
                        </SwiftButton>
                        <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
                          <SwiftButton
                            label="Earlier"
                            systemImage="arrow.up"
                            modifiers={[
                              disabled(
                                !isOnline || scheduleIndex === 0 || reorderMutation.isPending,
                              ),
                              tint(colors.accent),
                            ]}
                            onPress={() => moveItem(scheduleIndex, -1)}
                          />
                          <SwiftButton
                            label="Later"
                            systemImage="arrow.down"
                            modifiers={[
                              disabled(
                                !isOnline ||
                                  scheduleIndex === timeline.length - 1 ||
                                  reorderMutation.isPending,
                              ),
                              tint(colors.accent),
                            ]}
                            onPress={() => moveItem(scheduleIndex, 1)}
                          />
                        </SwipeActions.Actions>
                        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
                          <SwiftButton
                            label="Delete"
                            systemImage="trash"
                            modifiers={[
                              disabled(!isOnline || deleteScheduleMutation.isPending),
                              tint(colors.danger),
                            ]}
                            onPress={() =>
                              confirmDelete('this item', () =>
                                deleteScheduleMutation.mutate(item.id),
                              )
                            }
                            role="destructive"
                          />
                        </SwipeActions.Actions>
                      </SwipeActions>
                    );
                  }

                  if (entry.kind === 'flight') {
                    const { event, flight } = entry;
                    return (
                      <SwipeActions key={entry.key} modifiers={[tag(entry.key)]}>
                        <HStack spacing={12}>
                          <Label
                            title={`Flight ${event === 'arrival' ? 'arrival' : 'departure'} · ${flight.flightNumber}`}
                            systemImage="airplane"
                            modifiers={[foregroundStyle(tone)]}
                          />
                          <VStack alignment="leading" spacing={3}>
                            {entry.time ? (
                              <SwiftText modifiers={[foregroundStyle(tone)]}>
                                {entry.time}
                              </SwiftText>
                            ) : null}
                            <SwiftText>{flightRoute(flight)}</SwiftText>
                            <SwiftText>{flightEventDetail(flight, event)}</SwiftText>
                          </VStack>
                        </HStack>
                        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
                          <SwiftButton
                            label="Delete"
                            systemImage="trash"
                            modifiers={[
                              disabled(!isOnline || deleteFlightMutation.isPending),
                              tint(colors.danger),
                            ]}
                            onPress={() =>
                              confirmDelete('this flight', () =>
                                deleteFlightMutation.mutate(flight.id),
                              )
                            }
                            role="destructive"
                          />
                        </SwipeActions.Actions>
                      </SwipeActions>
                    );
                  }

                  const { event, stay } = entry;
                  return (
                    <SwipeActions key={entry.key} modifiers={[tag(entry.key)]}>
                      <SwiftButton
                        modifiers={[buttonStyle('plain')]}
                        onPress={() =>
                          router.push({
                            pathname: '/itinerary-editor',
                            params: { kind: 'stay', id: stay.id },
                          })
                        }
                      >
                        <HStack spacing={12}>
                          <Label
                            title={`${stayEventTitle(event)} · ${stay.name}`}
                            systemImage="bed.double.fill"
                            modifiers={[foregroundStyle(tone)]}
                          />
                          <VStack alignment="leading" spacing={3}>
                            {entry.time ? (
                              <SwiftText modifiers={[foregroundStyle(tone)]}>
                                {entry.time}
                              </SwiftText>
                            ) : null}
                            <SwiftText>
                              {formatDateRange(stay.checkInDate, stay.checkOutDate)}
                            </SwiftText>
                          </VStack>
                          <Spacer />
                          <SwiftText>›</SwiftText>
                        </HStack>
                      </SwiftButton>
                      <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
                        <SwiftButton
                          label="Delete"
                          systemImage="trash"
                          modifiers={[
                            disabled(!isOnline || deleteStayMutation.isPending),
                            tint(colors.danger),
                          ]}
                          onPress={() =>
                            confirmDelete('this stay', () => deleteStayMutation.mutate(stay.id))
                          }
                          role="destructive"
                        />
                      </SwipeActions.Actions>
                    </SwipeActions>
                  );
                })
              ) : (
                <VStack alignment="leading" spacing={4}>
                  <SwiftText>Nothing planned yet</SwiftText>
                  <SwiftText>Add a saved place or a custom activity to build this day.</SwiftText>
                </VStack>
              )}
            </Section>
            <Section title="Trip details">
              <SwiftButton
                modifiers={[buttonStyle('plain')]}
                onPress={() => router.push('/itinerary/visual')}
              >
                <HStack spacing={12}>
                  <Label title="Visual itinerary" systemImage="map" />
                  <Spacer />
                  <SwiftText>›</SwiftText>
                </HStack>
              </SwiftButton>
              <SwiftButton
                modifiers={[buttonStyle('plain')]}
                onPress={() => router.push('/reminders')}
              >
                <HStack spacing={12}>
                  <Label title="Personal reminders" systemImage="bell" />
                  <Spacer />
                  <SwiftText>›</SwiftText>
                </HStack>
              </SwiftButton>
              <SwiftButton
                modifiers={[buttonStyle('plain')]}
                onPress={() =>
                  router.push({
                    pathname: '/itinerary-editor',
                    params: { kind: 'day', id: selectedDay.id },
                  })
                }
              >
                <HStack spacing={12}>
                  <Label title="Day note" systemImage="note.text" />
                  <Spacer />
                  <SwiftText>›</SwiftText>
                </HStack>
              </SwiftButton>
              <SwiftButton
                modifiers={[buttonStyle('plain')]}
                onPress={() =>
                  router.push({ pathname: '/itinerary-editor', params: { kind: 'stays' } })
                }
              >
                <HStack spacing={12}>
                  <Label title={`Stays (${trip.stays.length})`} systemImage="bed.double" />
                  <Spacer />
                  <SwiftText>›</SwiftText>
                </HStack>
              </SwiftButton>
              <SwiftButton
                modifiers={[buttonStyle('plain')]}
                onPress={() =>
                  router.push({
                    pathname: '/itinerary-editor',
                    params: { kind: 'flights', date: selectedDay.date },
                  })
                }
              >
                <HStack spacing={12}>
                  <Label title={`Flights (${trip.flights.length})`} systemImage="airplane" />
                  <Spacer />
                  <SwiftText>›</SwiftText>
                </HStack>
              </SwiftButton>
              <SwiftButton
                modifiers={[buttonStyle('plain')]}
                onPress={() =>
                  router.push({ pathname: '/itinerary-editor', params: { kind: 'places' } })
                }
              >
                <HStack spacing={12}>
                  <Label
                    title={`Saved places (${trip.places.length})`}
                    systemImage="mappin.and.ellipse"
                  />
                  <Spacer />
                  <SwiftText>›</SwiftText>
                </HStack>
              </SwiftButton>
              <SwiftButton
                modifiers={[buttonStyle('plain')]}
                onPress={() =>
                  router.push({ pathname: '/itinerary-editor', params: { kind: 'locations' } })
                }
              >
                <HStack spacing={12}>
                  <Label
                    title={`Locations (${trip.locationSegments.length})`}
                    systemImage="globe.europe.africa"
                  />
                  <Spacer />
                  <SwiftText>›</SwiftText>
                </HStack>
              </SwiftButton>
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
            tintColor={colors.accent}
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
              onPress={() => selectTripDay(day.date)}
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
          {dayEntries.length ? (
            dayEntries.map(entry => {
              const tone = itineraryEntryTone(entry.kind, theme);
              const cardStyle = {
                backgroundColor:
                  entry.kind === 'schedule' ? undefined : itineraryEntrySurface(tone, theme),
                borderLeftColor: tone,
                borderLeftWidth: 4,
              };

              if (entry.kind === 'schedule') {
                const { item, scheduleIndex } = entry;
                return (
                  <View key={entry.key} style={{ gap: 6 }}>
                    {entry.time ? (
                      <Text
                        selectable
                        style={{
                          color: tone,
                          fontSize: 14,
                          fontVariant: ['tabular-nums'],
                          fontWeight: '800',
                        }}
                      >
                        {entry.time}
                      </Text>
                    ) : null}
                    <Card style={cardStyle}>
                      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text
                            selectable
                            style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
                          >
                            {entryTitle(item, trip.places)}
                          </Text>
                          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                            {formatDuration(item.duration)}
                            {item.amount != null && item.currency
                              ? ` · ${formatMoney(item.amount, item.currency)}`
                              : ''}
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
                          <IconButton label={`Edit ${entryTitle(item, trip.places)}`}>
                            Edit
                          </IconButton>
                        </Link>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <IconButton
                          disabled={!isOnline || scheduleIndex === 0 || reorderMutation.isPending}
                          label="Move item earlier"
                          onPress={() => moveItem(scheduleIndex, -1)}
                        >
                          ↑
                        </IconButton>
                        <IconButton
                          disabled={
                            !isOnline ||
                            scheduleIndex === timeline.length - 1 ||
                            reorderMutation.isPending
                          }
                          label="Move item later"
                          onPress={() => moveItem(scheduleIndex, 1)}
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
                  </View>
                );
              }

              if (entry.kind === 'flight') {
                const { event, flight } = entry;
                return (
                  <View key={entry.key} style={{ gap: 6 }}>
                    {entry.time ? (
                      <Text
                        selectable
                        style={{
                          color: tone,
                          fontSize: 14,
                          fontVariant: ['tabular-nums'],
                          fontWeight: '800',
                        }}
                      >
                        {entry.time}
                      </Text>
                    ) : null}
                    <Card style={cardStyle}>
                      <Text selectable style={{ color: tone, fontSize: 16, fontWeight: '700' }}>
                        Flight {event === 'arrival' ? 'arrival' : 'departure'} ·{' '}
                        {flight.flightNumber}
                      </Text>
                      <Text selectable style={{ color: colors.textMuted }}>
                        {flightRoute(flight)}
                      </Text>
                      <Text selectable style={{ color: colors.textMuted }}>
                        {flightEventDetail(flight, event)}
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
                  </View>
                );
              }

              const { event, stay } = entry;
              return (
                <View key={entry.key} style={{ gap: 6 }}>
                  {entry.time ? (
                    <Text
                      selectable
                      style={{
                        color: tone,
                        fontSize: 14,
                        fontVariant: ['tabular-nums'],
                        fontWeight: '800',
                      }}
                    >
                      {entry.time}
                    </Text>
                  ) : null}
                  <Card style={cardStyle}>
                    <Text selectable style={{ color: tone, fontSize: 16, fontWeight: '700' }}>
                      {stayEventTitle(event)} · {stay.name}
                    </Text>
                    <Text selectable style={{ color: colors.textMuted }}>
                      {formatDateRange(stay.checkInDate, stay.checkOutDate)}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Link
                        href={{
                          pathname: '/itinerary-editor',
                          params: { kind: 'stay', id: stay.id },
                        }}
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
                </View>
              );
            })
          ) : (
            <EmptyState
              title="Nothing planned yet"
              detail="Add a saved place or a custom activity to build this day."
            />
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>
            Trip details
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Link href="/itinerary/visual" asChild>
              <Button tone="secondary">Visual itinerary</Button>
            </Link>
            <Link href="/reminders" asChild>
              <Button tone="secondary">Personal reminders</Button>
            </Link>
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
          tintColor={colors.accent}
        />
      </Stack.Toolbar>
    </>
  );
}
