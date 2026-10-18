import AddIcon from '@expo/material-symbols/add.xml';
import MoreIcon from '@expo/material-symbols/more_vert.xml';
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
  accessibilityAddTraits,
  accessibilityLabel,
  backgroundOverlay,
  buttonBorderShape,
  buttonStyle,
  cornerRadius,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listStyle,
  monospacedDigit,
  padding,
  refreshable,
  strokeBorder,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { orderScheduleItemsForDay } from '@wayfare/domain';
import { Link, router, Stack } from 'expo-router';
import * as React from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';

import {
  deleteFlight,
  deleteSchedule,
  deleteStay,
  updateActivityReservationLock,
  updateSchedule,
} from '@/api/trips';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ErrorState, EmptyState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { canModifyActivity } from '@/features/itinerary/activity-lock';
import { dayItineraryEntries, type DayItineraryEntry } from '@/features/itinerary/day-itinerary';
import { sectionExploreDaysByLocation } from '@/features/explore/explore-trip-days';
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

function itineraryEntryTone(entry: DayItineraryEntry, theme: 'light' | 'dark') {
  if (entry.kind === 'schedule') return theme === 'light' ? '#17795d' : '#4ab58b';
  if (entry.kind === 'flight') {
    return entry.event === 'arrival'
      ? theme === 'light'
        ? '#e8795d'
        : '#f08b70'
      : theme === 'light'
        ? '#17795d'
        : '#4ab58b';
  }
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

function dayDateParts(shortDate: string) {
  const [month = '', day = shortDate] = shortDate.split(' ');
  return { day, month };
}

function scheduleEntryDetail(item: {
  amount?: number;
  currency?: string;
  duration: number;
  note?: string;
}) {
  return [
    formatDuration(item.duration),
    item.amount != null && item.currency ? formatMoney(item.amount, item.currency) : null,
    item.note,
  ]
    .filter(Boolean)
    .join(' · ');
}

function entryCountLabel(count: number) {
  return count === 1 ? '1 item planned' : `${count} items planned`;
}

const dayCardWidth = 70;
const dayCardHeight = 72;
const dayCardGap = 5;
const dateStripRadius = 10;

function tripDetailsMenu({
  dayId,
  date,
  flightCount,
  locationCount,
  stayCount,
}: {
  dayId: string;
  date: string;
  flightCount: number;
  locationCount: number;
  stayCount: number;
}) {
  return (
    <Stack.Toolbar.Menu
      accessibilityLabel="Open trip details"
      icon={process.env.EXPO_OS === 'ios' ? 'ellipsis' : MoreIcon}
      title="Trip details"
    >
      <Stack.Toolbar.MenuAction onPress={() => router.push('/itinerary/visual')}>
        Visual itinerary
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction onPress={() => router.push('/reminders')}>
        Personal reminders
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        onPress={() =>
          router.push({ pathname: '/itinerary-editor', params: { kind: 'day', id: dayId } })
        }
      >
        Day note
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        onPress={() => router.push({ pathname: '/itinerary-editor', params: { kind: 'stays' } })}
      >
        {`Stays (${stayCount})`}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        onPress={() =>
          router.push({ pathname: '/itinerary-editor', params: { kind: 'flights', date } })
        }
      >
        {`Flights (${flightCount})`}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        onPress={() =>
          router.push({ pathname: '/itinerary-editor', params: { kind: 'locations' } })
        }
      >
        {`Locations (${locationCount})`}
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  );
}

export function ItineraryScreen() {
  const { theme } = useTheme();
  const { isLoadingTrips, selectedTrip, selectedTripDayDate, selectTripDay } = useTrips();
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
  const { mutation: reservationLockMutation } = useTripMutation(
    trip?.id ?? '',
    ({ scheduleId, locked }: { scheduleId: string; locked: boolean }) =>
      updateActivityReservationLock(trip!.id, scheduleId, locked),
  );

  if (isLoadingTrips || tripQuery.isLoading) {
    return <LoadingState label="Loading your itinerary…" />;
  }
  if (!selectedTrip) {
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
  const dayLocationSections = sectionExploreDaysByLocation(trip.days, trip.locationSegments);

  function confirmDelete(label: string, onConfirm: () => void) {
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }

  function moveItem(index: number, direction: -1 | 1) {
    const next = timeline[index + direction];
    const current = timeline[index];
    if (
      !next ||
      !current ||
      !isOnline ||
      !trip?.access.canEdit ||
      current.reservationLocked ||
      next.reservationLocked ||
      current.sortOrder === undefined ||
      next.sortOrder === undefined
    )
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
                <HStack alignment="bottom" spacing={dayCardGap}>
                  {dayLocationSections.map(locationSection => {
                    const sectionWidth =
                      locationSection.days.length * dayCardWidth +
                      Math.max(0, locationSection.days.length - 1) * dayCardGap;

                    return (
                      <VStack
                        key={`${locationSection.id}:${locationSection.days[0]?.date}`}
                        alignment="leading"
                        spacing={dayCardGap}
                      >
                        {trip.locationSegments.length ? (
                          <SwiftText
                            modifiers={[
                              font({ textStyle: 'caption', weight: 'semibold' }),
                              foregroundStyle(
                                locationSection.id === 'unassigned' ? 'secondary' : colors.accent,
                              ),
                              padding({ horizontal: 8, vertical: 6 }),
                              frame({ width: sectionWidth, height: 30, alignment: 'center' }),
                              backgroundOverlay({
                                color:
                                  locationSection.id === 'unassigned'
                                    ? colors.surfaceMuted
                                    : `${colors.accent}14`,
                              }),
                              cornerRadius(dateStripRadius),
                              strokeBorder({
                                color:
                                  locationSection.id === 'unassigned'
                                    ? colors.border
                                    : colors.borderStrong,
                                shape: 'roundedRectangle',
                                cornerRadius: dateStripRadius,
                              }),
                              lineLimit(1),
                            ]}
                          >
                            {locationSection.id === 'unassigned'
                              ? ' '
                              : locationSection.locationName}
                          </SwiftText>
                        ) : null}
                        <HStack spacing={dayCardGap}>
                          {locationSection.days.map(day => {
                            const isSelected = day.date === selectedDay.date;
                            const { day: dayNumber, month } = dayDateParts(day.shortDate);

                            return (
                              <SwiftButton
                                key={day.id}
                                modifiers={[
                                  buttonStyle(isSelected ? 'borderedProminent' : 'bordered'),
                                  buttonBorderShape('roundedRectangle', dateStripRadius),
                                  frame({ width: dayCardWidth, height: dayCardHeight }),
                                  accessibilityLabel(
                                    `View ${day.label}, ${formatDate(day.date, {
                                      weekday: 'long',
                                      month: 'long',
                                    })}`,
                                  ),
                                  ...(isSelected ? [accessibilityAddTraits(['isSelected'])] : []),
                                ]}
                                onPress={() => selectTripDay(day.date)}
                              >
                                <VStack alignment="center" spacing={1}>
                                  <SwiftText
                                    modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}
                                  >
                                    {day.weekday}
                                  </SwiftText>
                                  <SwiftText
                                    modifiers={[
                                      font({ textStyle: 'title3', weight: 'bold' }),
                                      monospacedDigit(),
                                    ]}
                                  >
                                    {dayNumber}
                                  </SwiftText>
                                  <SwiftText modifiers={[font({ textStyle: 'caption2' })]}>
                                    {month}
                                  </SwiftText>
                                </VStack>
                              </SwiftButton>
                            );
                          })}
                        </HStack>
                      </VStack>
                    );
                  })}
                </HStack>
              </SwiftScrollView>
            </Section>
            <Section
              footer={
                <SwiftText>
                  {dayEntries.length
                    ? entryCountLabel(dayEntries.length)
                    : 'Keep this day open or add an activity when you are ready.'}
                </SwiftText>
              }
              title="Day plan"
            >
              <VStack alignment="leading" spacing={2}>
                <SwiftText modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>
                  {selectedDay.label} ·{' '}
                  {formatDate(selectedDay.date, { weekday: 'long', month: 'long' })}
                </SwiftText>
                <SwiftText
                  modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}
                >
                  {entryCountLabel(dayEntries.length)}
                </SwiftText>
              </VStack>
              {selectedDay.notes ? <SwiftText>{selectedDay.notes}</SwiftText> : null}
              {dayEntries.length ? (
                dayEntries.map(entry => {
                  const tone = itineraryEntryTone(entry, theme);

                  if (entry.kind === 'schedule') {
                    const { item, scheduleIndex } = entry;
                    const title = entryTitle(item, trip.places);
                    const activityTone = item.reservationLocked ? colors.locked : tone;
                    const canModify = canModifyActivity(item, {
                      canEdit: trip.access.canEdit,
                      isOnline,
                      pending: reservationLockMutation.isPending,
                    });
                    return (
                      <SwipeActions key={entry.key} modifiers={[tag(entry.key)]}>
                        <SwiftButton
                          modifiers={[buttonStyle('plain'), disabled(item.reservationLocked)]}
                          onPress={() =>
                            router.push({
                              pathname: '/itinerary-editor',
                              params: { kind: 'schedule', id: item.id, date: item.date },
                            })
                          }
                        >
                          <HStack
                            alignment="firstTextBaseline"
                            spacing={12}
                            modifiers={
                              item.reservationLocked
                                ? [
                                    padding({ horizontal: 10, vertical: 8 }),
                                    backgroundOverlay({ color: colors.lockedSurface }),
                                    cornerRadius(10),
                                    strokeBorder({
                                      color: colors.lockedBorder,
                                      shape: 'roundedRectangle',
                                      cornerRadius: 10,
                                    }),
                                  ]
                                : []
                            }
                          >
                            <VStack alignment="trailing" spacing={2}>
                              {entry.time ? (
                                <SwiftText
                                  modifiers={[
                                    font({ weight: 'semibold' }),
                                    foregroundStyle(activityTone),
                                    monospacedDigit(),
                                  ]}
                                >
                                  {entry.time}
                                </SwiftText>
                              ) : null}
                              <SwiftText
                                modifiers={[
                                  font({ textStyle: 'caption2' }),
                                  foregroundStyle('secondary'),
                                ]}
                              >
                                {item.reservationLocked ? 'Locked' : 'Activity'}
                              </SwiftText>
                            </VStack>
                            <VStack alignment="leading" spacing={3}>
                              <Label
                                title={title}
                                systemImage={
                                  item.reservationLocked ? 'lock.fill' : 'mappin.circle.fill'
                                }
                                modifiers={[foregroundStyle(activityTone)]}
                              />
                              <SwiftText modifiers={[foregroundStyle('secondary')]}>
                                {scheduleEntryDetail(item)}
                              </SwiftText>
                            </VStack>
                            <Spacer />
                            <SwiftText modifiers={[foregroundStyle('secondary')]}>›</SwiftText>
                          </HStack>
                        </SwiftButton>
                        <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
                          <SwiftButton
                            label="Earlier"
                            systemImage="arrow.up"
                            modifiers={[
                              disabled(
                                !canModify ||
                                  scheduleIndex === 0 ||
                                  timeline[scheduleIndex - 1]?.reservationLocked ||
                                  reorderMutation.isPending,
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
                                !canModify ||
                                  scheduleIndex === timeline.length - 1 ||
                                  timeline[scheduleIndex + 1]?.reservationLocked ||
                                  reorderMutation.isPending,
                              ),
                              tint(colors.accent),
                            ]}
                            onPress={() => moveItem(scheduleIndex, 1)}
                          />
                        </SwipeActions.Actions>
                        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
                          <SwiftButton
                            label={item.reservationLocked ? 'Unlock' : 'Lock'}
                            systemImage={item.reservationLocked ? 'lock.open' : 'lock.fill'}
                            modifiers={[
                              accessibilityLabel(
                                item.reservationLocked ? `Unlock ${title}` : `Lock ${title}`,
                              ),
                              disabled(
                                !isOnline ||
                                  !trip.access.canEdit ||
                                  reservationLockMutation.isPending,
                              ),
                              tint(item.reservationLocked ? colors.locked : colors.accent),
                            ]}
                            onPress={() =>
                              reservationLockMutation.mutate({
                                scheduleId: item.id,
                                locked: !item.reservationLocked,
                              })
                            }
                          />
                          <SwiftButton
                            label="Delete"
                            systemImage="trash"
                            modifiers={[
                              disabled(!canModify || deleteScheduleMutation.isPending),
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
                        <HStack alignment="firstTextBaseline" spacing={12}>
                          <VStack alignment="trailing" spacing={2}>
                            {entry.time ? (
                              <SwiftText
                                modifiers={[
                                  font({ weight: 'semibold' }),
                                  foregroundStyle(tone),
                                  monospacedDigit(),
                                ]}
                              >
                                {entry.time}
                              </SwiftText>
                            ) : null}
                            <SwiftText
                              modifiers={[
                                font({ textStyle: 'caption2' }),
                                foregroundStyle('secondary'),
                              ]}
                            >
                              Flight
                            </SwiftText>
                          </VStack>
                          <VStack alignment="leading" spacing={3}>
                            <Label
                              title={`${event === 'arrival' ? 'Arrive' : 'Depart'} · ${flight.flightNumber}`}
                              systemImage={
                                event === 'arrival' ? 'airplane.arrival' : 'airplane.departure'
                              }
                              modifiers={[foregroundStyle(tone)]}
                            />
                            <SwiftText>{flightRoute(flight)}</SwiftText>
                            <SwiftText modifiers={[foregroundStyle('secondary')]}>
                              {flightEventDetail(flight, event)}
                            </SwiftText>
                          </VStack>
                          <Spacer />
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
                        <HStack alignment="firstTextBaseline" spacing={12}>
                          <VStack alignment="trailing" spacing={2}>
                            {entry.time ? (
                              <SwiftText
                                modifiers={[
                                  font({ weight: 'semibold' }),
                                  foregroundStyle(tone),
                                  monospacedDigit(),
                                ]}
                              >
                                {entry.time}
                              </SwiftText>
                            ) : null}
                            <SwiftText
                              modifiers={[
                                font({ textStyle: 'caption2' }),
                                foregroundStyle('secondary'),
                              ]}
                            >
                              Stay
                            </SwiftText>
                          </VStack>
                          <VStack alignment="leading" spacing={3}>
                            <Label
                              title={`${stayEventTitle(event)} · ${stay.name}`}
                              systemImage="bed.double.fill"
                              modifiers={[foregroundStyle(tone)]}
                            />
                            <SwiftText modifiers={[foregroundStyle('secondary')]}>
                              {formatDateRange(stay.checkInDate, stay.checkOutDate)}
                            </SwiftText>
                          </VStack>
                          <Spacer />
                          <SwiftText modifiers={[foregroundStyle('secondary')]}>›</SwiftText>
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
          </List>
        </Host>
        <Stack.Toolbar placement="right">
          {tripDetailsMenu({
            date: selectedDay.date,
            dayId: selectedDay.id,
            flightCount: trip.flights.length,
            locationCount: trip.locationSegments.length,
            stayCount: trip.stays.length,
          })}
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
        <View style={{ gap: 3 }}>
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 }}
          >
            DAY-BY-DAY ITINERARY
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 14 }}>
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <View
            style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
              Days
            </Text>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
              {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: dayCardGap, paddingHorizontal: 2 }}
          >
            {dayLocationSections.map(locationSection => (
              <View
                key={`${locationSection.id}:${locationSection.days[0]?.date}`}
                style={{
                  gap: dayCardGap,
                  width:
                    locationSection.days.length * dayCardWidth +
                    Math.max(0, locationSection.days.length - 1) * dayCardGap,
                }}
              >
                {trip.locationSegments.length ? (
                  <Text
                    selectable
                    numberOfLines={1}
                    style={{
                      backgroundColor:
                        locationSection.id === 'unassigned'
                          ? colors.surfaceMuted
                          : `${colors.accent}14`,
                      borderColor:
                        locationSection.id === 'unassigned' ? colors.border : colors.borderStrong,
                      borderCurve: 'continuous',
                      borderRadius: dateStripRadius,
                      borderWidth: 1,
                      color: locationSection.id === 'unassigned' ? colors.textMuted : colors.accent,
                      fontSize: 12,
                      fontWeight: '700',
                      height: 30,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      textAlign: 'center',
                    }}
                  >
                    {locationSection.id === 'unassigned' ? ' ' : locationSection.locationName}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: dayCardGap }}>
                  {locationSection.days.map(day => {
                    const isSelected = day.date === selectedDay.date;
                    const { day: dayNumber, month } = dayDateParts(day.shortDate);
                    const textColor = isSelected ? colors.accentText : colors.text;

                    return (
                      <Button
                        key={day.id}
                        accessibilityLabel={`View ${day.label}, ${formatDate(day.date, {
                          weekday: 'long',
                          month: 'long',
                        })}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => selectTripDay(day.date)}
                        style={{
                          borderRadius: dateStripRadius,
                          height: dayCardHeight,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          width: dayCardWidth,
                        }}
                        tone={isSelected ? 'primary' : 'secondary'}
                      >
                        <View style={{ alignItems: 'center', gap: 1 }}>
                          <Text
                            selectable
                            style={{ color: textColor, fontSize: 11, fontWeight: '800' }}
                          >
                            {day.weekday}
                          </Text>
                          <Text
                            selectable
                            style={{
                              color: textColor,
                              fontSize: 24,
                              fontVariant: ['tabular-nums'],
                              fontWeight: '800',
                              lineHeight: 28,
                            }}
                          >
                            {dayNumber}
                          </Text>
                          <Text
                            selectable
                            style={{ color: textColor, fontSize: 11, fontWeight: '600' }}
                          >
                            {month}
                          </Text>
                        </View>
                      </Button>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <Card style={{ backgroundColor: colors.surfaceMuted, gap: 12 }}>
          <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                selectable
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 0.7,
                }}
              >
                CURRENT DAY PLAN
              </Text>
              <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                {selectedDay.label}
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: 14 }}>
                {formatDate(selectedDay.date, { weekday: 'long', month: 'long' })}
              </Text>
            </View>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
                borderCurve: 'continuous',
                borderRadius: 12,
                borderWidth: 1,
                minWidth: 64,
                paddingHorizontal: 9,
                paddingVertical: 8,
              }}
            >
              <Text
                selectable
                style={{
                  color: colors.accent,
                  fontSize: 17,
                  fontVariant: ['tabular-nums'],
                  fontWeight: '800',
                }}
              >
                {dayEntries.length}
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>
                {dayEntries.length === 1 ? 'ITEM' : 'ITEMS'}
              </Text>
            </View>
          </View>
          {selectedDay.notes ? (
            <View
              style={{
                borderLeftColor: colors.borderStrong,
                borderLeftWidth: 3,
                gap: 3,
                paddingLeft: 10,
              }}
            >
              <Text selectable style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800' }}>
                DAY NOTE
              </Text>
              <Text selectable style={{ color: colors.text, lineHeight: 20 }}>
                {selectedDay.notes}
              </Text>
            </View>
          ) : null}
        </Card>

        <View style={{ gap: space.sm }}>
          <View
            style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>
              Plan
            </Text>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
              {dayEntries.length ? entryCountLabel(dayEntries.length) : 'Open day'}
            </Text>
          </View>
          {dayEntries.length ? (
            dayEntries.map((entry, entryIndex) => {
              const tone = itineraryEntryTone(entry, theme);
              const cardStyle = {
                backgroundColor:
                  entry.kind === 'schedule' ? undefined : itineraryEntrySurface(tone, theme),
                borderLeftColor: tone,
                borderLeftWidth: 4,
              };

              if (entry.kind === 'schedule') {
                const { item, scheduleIndex } = entry;
                const title = entryTitle(item, trip.places);
                const canModify = canModifyActivity(item, {
                  canEdit: trip.access.canEdit,
                  isOnline,
                  pending: reservationLockMutation.isPending,
                });
                return (
                  <View key={entry.key} style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ alignItems: 'flex-end', paddingTop: 15, width: 58 }}>
                      {entry.time ? (
                        <Text
                          selectable
                          style={{
                            color: tone,
                            fontSize: 12,
                            fontVariant: ['tabular-nums'],
                            fontWeight: '800',
                          }}
                        >
                          {entry.time}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'center', width: 14 }}>
                      <View
                        style={{
                          backgroundColor: tone,
                          borderColor: colors.background,
                          borderRadius: 8,
                          borderWidth: 3,
                          height: 14,
                          marginTop: 16,
                          width: 14,
                          zIndex: 1,
                        }}
                      />
                      {entryIndex < dayEntries.length - 1 ? (
                        <View
                          style={{
                            backgroundColor: colors.border,
                            flex: 1,
                            marginTop: -1,
                            width: 2,
                          }}
                        />
                      ) : null}
                    </View>
                    <Card
                      style={[
                        cardStyle,
                        { flex: 1, marginBottom: space.sm },
                        item.reservationLocked
                          ? {
                              backgroundColor: colors.lockedSurface,
                              borderColor: colors.lockedBorder,
                            }
                          : undefined,
                      ]}
                    >
                      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text
                            selectable
                            style={{
                              color: item.reservationLocked ? colors.locked : tone,
                              fontSize: 12,
                              fontWeight: '800',
                            }}
                          >
                            {item.reservationLocked ? '🔒 LOCKED ACTIVITY' : 'ACTIVITY'}
                          </Text>
                          <Text
                            selectable
                            style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
                          >
                            {title}
                          </Text>
                          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                            {scheduleEntryDetail(item)}
                          </Text>
                        </View>
                        <Link
                          href={{
                            pathname: '/itinerary-editor',
                            params: { kind: 'schedule', id: item.id, date: item.date },
                          }}
                          asChild
                        >
                          <IconButton disabled={!canModify} label={`Edit ${title}`}>
                            Edit
                          </IconButton>
                        </Link>
                        <IconButton
                          disabled={!isOnline || !trip.access.canEdit}
                          label={
                            item.reservationLocked
                              ? `Unlock ${entryTitle(item, trip.places)}`
                              : `Lock ${entryTitle(item, trip.places)}`
                          }
                          loading={reservationLockMutation.isPending}
                          onPress={() =>
                            reservationLockMutation.mutate({
                              scheduleId: item.id,
                              locked: !item.reservationLocked,
                            })
                          }
                        >
                          <Text style={{ fontSize: 17 }}>
                            {item.reservationLocked ? '🔓' : '🔒'}
                          </Text>
                        </IconButton>
                      </View>
                      <Button
                        accessibilityLabel={`Open files and links for ${title}`}
                        onPress={() =>
                          router.push({
                            pathname: '/item-details',
                            params: { kind: 'ACTIVITY', itemId: item.id },
                          })
                        }
                        tone="secondary"
                      >
                        Files &amp; links
                      </Button>
                      {item.reservationLocked ? (
                        <Text selectable style={{ color: colors.locked, fontSize: 13 }}>
                          Unlock this activity to edit, move, or delete it.
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <IconButton
                          disabled={
                            !canModify ||
                            scheduleIndex === 0 ||
                            timeline[scheduleIndex - 1]?.reservationLocked ||
                            reorderMutation.isPending
                          }
                          label="Move item earlier"
                          onPress={() => moveItem(scheduleIndex, -1)}
                        >
                          ↑
                        </IconButton>
                        <IconButton
                          disabled={
                            !canModify ||
                            scheduleIndex === timeline.length - 1 ||
                            timeline[scheduleIndex + 1]?.reservationLocked ||
                            reorderMutation.isPending
                          }
                          label="Move item later"
                          onPress={() => moveItem(scheduleIndex, 1)}
                        >
                          ↓
                        </IconButton>
                        <Button
                          disabled={!canModify || deleteScheduleMutation.isPending}
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
                  <View key={entry.key} style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ alignItems: 'flex-end', paddingTop: 15, width: 58 }}>
                      {entry.time ? (
                        <Text
                          selectable
                          style={{
                            color: tone,
                            fontSize: 12,
                            fontVariant: ['tabular-nums'],
                            fontWeight: '800',
                          }}
                        >
                          {entry.time}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'center', width: 14 }}>
                      <View
                        style={{
                          backgroundColor: tone,
                          borderColor: colors.background,
                          borderRadius: 8,
                          borderWidth: 3,
                          height: 14,
                          marginTop: 16,
                          width: 14,
                          zIndex: 1,
                        }}
                      />
                      {entryIndex < dayEntries.length - 1 ? (
                        <View
                          style={{
                            backgroundColor: colors.border,
                            flex: 1,
                            marginTop: -1,
                            width: 2,
                          }}
                        />
                      ) : null}
                    </View>
                    <Card style={[cardStyle, { flex: 1, marginBottom: space.sm }]}>
                      <Text selectable style={{ color: tone, fontSize: 12, fontWeight: '800' }}>
                        FLIGHT
                      </Text>
                      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 7 }}>
                        <Text
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                          style={{
                            color: tone,
                            fontSize: 17,
                            transform: [{ rotate: event === 'arrival' ? '90deg' : '0deg' }],
                          }}
                        >
                          ✈︎
                        </Text>
                        <Text
                          selectable
                          style={{ color: tone, flex: 1, fontSize: 16, fontWeight: '700' }}
                        >
                          {event === 'arrival' ? 'Arrive' : 'Depart'} · {flight.flightNumber}
                        </Text>
                      </View>
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
                <View key={entry.key} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ alignItems: 'flex-end', paddingTop: 15, width: 58 }}>
                    {entry.time ? (
                      <Text
                        selectable
                        style={{
                          color: tone,
                          fontSize: 12,
                          fontVariant: ['tabular-nums'],
                          fontWeight: '800',
                        }}
                      >
                        {entry.time}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'center', width: 14 }}>
                    <View
                      style={{
                        backgroundColor: tone,
                        borderColor: colors.background,
                        borderRadius: 8,
                        borderWidth: 3,
                        height: 14,
                        marginTop: 16,
                        width: 14,
                        zIndex: 1,
                      }}
                    />
                    {entryIndex < dayEntries.length - 1 ? (
                      <View
                        style={{ backgroundColor: colors.border, flex: 1, marginTop: -1, width: 2 }}
                      />
                    ) : null}
                  </View>
                  <Card style={[cardStyle, { flex: 1, marginBottom: space.sm }]}>
                    <Text selectable style={{ color: tone, fontSize: 12, fontWeight: '800' }}>
                      STAY
                    </Text>
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
      </Screen>
      <Stack.Toolbar placement="right">
        {tripDetailsMenu({
          date: selectedDay.date,
          dayId: selectedDay.id,
          flightCount: trip.flights.length,
          locationCount: trip.locationSegments.length,
          stayCount: trip.stays.length,
        })}
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
