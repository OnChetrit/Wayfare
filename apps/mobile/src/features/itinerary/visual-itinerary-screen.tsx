import { router } from 'expo-router';
import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { LocationSegment, ScheduleItem, Stay, TripDay, TripFlight } from '@wayfare/domain';
import {
  createLocationDivision,
  createSchedule,
  moveLocationBoundary,
  updateActivityReservationLock,
  updateSchedule,
  updateStay,
} from '@/api/trips';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { canModifyActivity } from '@/features/itinerary/activity-lock';
import { DayRouteMap } from '@/features/itinerary/day-route-map';
import {
  flightEventDetail,
  flightEventsForDate,
  flightRoute,
} from '@/features/itinerary/flight-details';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import {
  isValidLocationRange,
  orderedLocationBoundaries,
  sortScheduleForDay,
  validBoundaryDates,
} from '@/features/itinerary/visual-itinerary';
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

type BoardLayout = 'horizontal' | 'vertical';
type ViewMode = 'board' | 'route';
type StayDateEdge = 'checkInDate' | 'checkOutDate';

function entryTitle(item: ScheduleItem, places: { id: string; name: string }[]) {
  return places.find(place => place.id === item.savedPlaceId)?.name ?? item.title ?? 'Activity';
}

function DayColumn({
  day,
  places,
  schedule,
  flights,
  onMove,
  onOpenDocuments,
  onToggleLock,
  canLock,
  lockPending,
  selected,
  onSelect,
}: {
  day: TripDay;
  flights: TripFlight[];
  onMove: (item: ScheduleItem) => void;
  onOpenDocuments: (item: ScheduleItem) => void;
  onToggleLock: (item: ScheduleItem) => void;
  canLock: boolean;
  lockPending: boolean;
  onSelect: () => void;
  places: { id: string; name: string }[];
  schedule: ScheduleItem[];
  selected: boolean;
}) {
  const entries = sortScheduleForDay(schedule, day.date);
  const dayFlights = flightEventsForDate(flights, day.date);
  return (
    <Card style={{ gap: 12, minWidth: 232 }}>
      <Button
        accessibilityLabel={`Select ${day.label}, ${day.shortDate}`}
        onPress={onSelect}
        tone={selected ? 'primary' : 'secondary'}
      >
        {day.label} · {day.shortDate}
      </Button>
      {entries.length || dayFlights.length ? (
        <View style={{ gap: 8 }}>
          {dayFlights.map(({ flight, kind }) => (
            <View
              key={`${flight.id}-${kind}`}
              style={{ borderLeftColor: '#4d7fa3', borderLeftWidth: 3, gap: 2, paddingLeft: 9 }}
            >
              <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                Flight {kind === 'arrival' ? 'arrival' : 'departure'} · {flight.flightNumber}
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                {flightRoute(flight)}
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                {flightEventDetail(flight, kind)}
              </Text>
            </View>
          ))}
          {entries.map(item => {
            const title = entryTitle(item, places);
            const canModify = canModifyActivity(item, {
              canEdit: canLock,
              isOnline: canLock,
              pending: lockPending,
            });

            return (
              <View
                key={item.id}
                style={{
                  backgroundColor: item.reservationLocked ? colors.lockedSurface : 'transparent',
                  borderColor: item.reservationLocked ? colors.lockedBorder : 'transparent',
                  borderRadius: 12,
                  borderWidth: item.reservationLocked ? 1 : 0,
                  gap: 4,
                  padding: item.reservationLocked ? 10 : 0,
                }}
              >
                {item.startTime ? (
                  <Text
                    selectable
                    style={{ color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] }}
                  >
                    {item.startTime}
                  </Text>
                ) : null}
                <View
                  style={{
                    borderLeftColor: item.reservationLocked ? colors.locked : colors.accent,
                    borderLeftWidth: 3,
                    gap: 4,
                    paddingLeft: 9,
                  }}
                >
                  {item.reservationLocked ? (
                    <Text
                      selectable
                      style={{ color: colors.locked, fontSize: 12, fontWeight: '800' }}
                    >
                      🔒 LOCKED ACTIVITY
                    </Text>
                  ) : null}
                  <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                    {title}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                    {formatDuration(item.duration)}
                    {item.amount != null && item.currency
                      ? ` · ${formatMoney(item.amount, item.currency)}`
                      : ''}
                    {item.note ? ` · ${item.note}` : ''}
                  </Text>
                  <Button
                    accessibilityLabel={`Open files and links for ${title}`}
                    onPress={() => onOpenDocuments(item)}
                    tone="secondary"
                  >
                    Files &amp; links
                  </Button>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      accessibilityLabel={`Move ${title} to another day`}
                      disabled={!canModify}
                      onPress={() => onMove(item)}
                      style={{ flex: 1 }}
                      tone="quiet"
                    >
                      Move to day
                    </Button>
                    <IconButton
                      disabled={!canLock}
                      label={item.reservationLocked ? `Unlock ${title}` : `Lock ${title}`}
                      loading={lockPending}
                      onPress={() => onToggleLock(item)}
                    >
                      <Text style={{ fontSize: 17 }}>{item.reservationLocked ? '🔓' : '🔒'}</Text>
                    </IconButton>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text selectable style={{ color: colors.textMuted }}>
          Open day
        </Text>
      )}
    </Card>
  );
}

function DateChooser({
  days,
  selectedDate,
  onSelect,
}: {
  days: TripDay[];
  onSelect: (date: string) => void;
  selectedDate: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {days.map(day => (
        <Button
          key={day.id}
          accessibilityLabel={`Choose ${day.label}, ${day.shortDate}`}
          onPress={() => onSelect(day.date)}
          tone={day.date === selectedDate ? 'primary' : 'secondary'}
        >
          {day.shortDate}
        </Button>
      ))}
    </ScrollView>
  );
}

export function VisualItineraryScreen() {
  useTheme();
  const { selectedTripDayDate, selectTripDay } = useTrips();
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
  const [overview, setOverview] = React.useState(true);
  const [layout, setLayout] = React.useState<BoardLayout>('horizontal');
  const [mode, setMode] = React.useState<ViewMode>('board');
  const [movingItem, setMovingItem] = React.useState<ScheduleItem | null>(null);
  const [showPlaces, setShowPlaces] = React.useState(false);
  const [locationName, setLocationName] = React.useState('');
  const [locationStart, setLocationStart] = React.useState<string | null>(null);
  const [locationEnd, setLocationEnd] = React.useState<string | null>(null);
  const [locationEdge, setLocationEdge] = React.useState<'start' | 'end'>('start');
  const [activeBoundary, setActiveBoundary] = React.useState<string | null>(null);
  const [stayDateEdit, setStayDateEdit] = React.useState<{
    stay: Stay;
    edge: StayDateEdge;
  } | null>(null);

  const activeTripId = trip?.id ?? '';
  const { isOnline, mutation: moveScheduleMutation } = useTripMutation(
    activeTripId,
    ({ item, date }: { item: ScheduleItem; date: string }) =>
      updateSchedule(activeTripId, item.id, { date, startTime: item.startTime }),
    { onSuccess: () => setMovingItem(null) },
  );
  const { mutation: addPlaceMutation } = useTripMutation(
    activeTripId,
    ({ date, placeId }: { date: string; placeId: string }) => {
      if (!trip) throw new Error('Trip not found.');
      const place = trip.places.find(candidate => candidate.id === placeId);
      if (!place) throw new Error('Saved place not found.');
      return createSchedule(activeTripId, {
        date,
        startTime: null,
        duration: 60,
        savedPlaceId: place.id,
        title: place.name,
        category: place.category,
      });
    },
    { onSuccess: () => setShowPlaces(false) },
  );
  const { mutation: createLocationMutation } = useTripMutation(
    activeTripId,
    () => {
      if (!locationName.trim()) throw new Error('Enter a location name.');
      if (!locationStart || !locationEnd || !isValidLocationRange(locationStart, locationEnd)) {
        throw new Error('Choose an end boundary after the start boundary.');
      }
      return createLocationDivision(activeTripId, {
        locationName: locationName.trim(),
        startDate: locationStart,
        endDate: locationEnd,
      });
    },
    {
      onSuccess: () => {
        setLocationName('');
        setLocationStart(null);
        setLocationEnd(null);
      },
    },
  );
  const { mutation: boundaryMutation } = useTripMutation(
    activeTripId,
    ({ left, right, date }: { left: LocationSegment; right: LocationSegment; date: string }) =>
      moveLocationBoundary(activeTripId, {
        leftSegmentId: left.id,
        newBoundary: date,
        rightSegmentId: right.id,
      }),
    { onSuccess: () => setActiveBoundary(null) },
  );
  const { mutation: stayDateMutation } = useTripMutation(
    activeTripId,
    ({ stay, edge, date }: { stay: Stay; edge: StayDateEdge; date: string }) => {
      const next = { ...stay, [edge]: date };
      if (next.checkInDate > next.checkOutDate) {
        throw new Error('A stay cannot check out before it checks in.');
      }
      return updateStay(activeTripId, stay.id, { [edge]: date });
    },
    { onSuccess: () => setStayDateEdit(null) },
  );
  const { mutation: reservationLockMutation } = useTripMutation(
    activeTripId,
    ({ itemId, locked }: { itemId: string; locked: boolean }) =>
      updateActivityReservationLock(activeTripId, itemId, locked),
  );

  if (tripQuery.isLoading) return <LoadingState label="Loading visual itinerary…" />;
  if (tripQuery.error) {
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }
  if (!trip || !trip.days.length) {
    return <ErrorState message="This trip does not have any days to plan." />;
  }

  const currentDate =
    selectedTripDayDate && trip.days.some(day => day.date === selectedTripDayDate)
      ? selectedTripDayDate
      : trip.days[0].date;
  const selectedDay = trip.days.find(day => day.date === currentDate) ?? trip.days[0];
  const boundaries = orderedLocationBoundaries(trip.locationSegments);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: space.xl }}
      style={{ backgroundColor: colors.background }}
    >
      <OfflineNotice visible={!isOnline} />
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
          Visual itinerary
        </Text>
        <Text selectable style={{ color: colors.textMuted }}>
          {trip.name} · {formatDateRange(trip.startDate, trip.endDate)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button onPress={() => setMode('board')} tone={mode === 'board' ? 'primary' : 'secondary'}>
          Itinerary
        </Button>
        <Button onPress={() => setMode('route')} tone={mode === 'route' ? 'primary' : 'secondary'}>
          Route map
        </Button>
      </View>

      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
          Selected day
        </Text>
        <DateChooser
          days={trip.days}
          onSelect={date => {
            selectTripDay(date);
            setOverview(false);
          }}
          selectedDate={currentDate}
        />
      </View>

      {mode === 'route' ? (
        <>
          <View style={{ gap: 2 }}>
            <Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>
              {overview
                ? 'All itinerary routes'
                : `${selectedDay.label} · ${formatDate(selectedDay.date, {
                    weekday: 'long',
                    month: 'long',
                  })}`}
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              Locations, stays, planned places, and flight airports with available coordinates.
            </Text>
          </View>
          <Button onPress={() => setOverview(true)}>All days</Button>
          <DayRouteMap
            date={overview ? '' : currentDate}
            trip={trip}
            onSelectDay={date => {
              setOverview(!date);
              if (date) selectTripDay(date);
            }}
          />
          {overview &&
            trip.days.map((day, index) => (
              <View key={day.id}>
                <Text selectable style={{ color: colors.text }}>
                  Day {index + 1} · {day.shortDate}
                </Text>
                {trip.schedule
                  .filter(item => item.date === day.date)
                  .sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'))
                  .map(item => (
                    <Text
                      selectable
                      key={item.id}
                      style={{ color: item.reservationLocked ? colors.locked : colors.text }}
                    >
                      {item.reservationLocked ? '🔒 ' : ''}
                      {item.startTime ?? 'Any time'} ·{' '}
                      {item.title ??
                        trip.places.find(place => place.id === item.savedPlaceId)?.name ??
                        'Activity'}
                      {!item.savedPlaceId && ' · No mapped stop'}
                    </Text>
                  ))}
                <Button
                  onPress={() =>
                    router.push({
                      pathname: '/itinerary-editor',
                      params: { kind: 'schedule', date: day.date },
                    })
                  }
                >
                  Add activity
                </Button>
              </View>
            ))}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              onPress={() => setLayout('horizontal')}
              tone={layout === 'horizontal' ? 'primary' : 'secondary'}
            >
              Horizontal board
            </Button>
            <Button
              onPress={() => setLayout('vertical')}
              tone={layout === 'vertical' ? 'primary' : 'secondary'}
            >
              Vertical list
            </Button>
          </View>
          {layout === 'horizontal' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {trip.days.map(day => (
                <DayColumn
                  day={day}
                  flights={trip.flights}
                  key={day.id}
                  canLock={isOnline && trip.access.canEdit}
                  lockPending={reservationLockMutation.isPending}
                  onMove={setMovingItem}
                  onOpenDocuments={item =>
                    router.push({
                      pathname: '/item-details',
                      params: { kind: 'ACTIVITY', itemId: item.id },
                    })
                  }
                  onToggleLock={item =>
                    reservationLockMutation.mutate({
                      itemId: item.id,
                      locked: !item.reservationLocked,
                    })
                  }
                  onSelect={() => selectTripDay(day.date)}
                  places={trip.places}
                  schedule={trip.schedule}
                  selected={day.date === currentDate}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={{ gap: 12 }}>
              {trip.days.map(day => (
                <DayColumn
                  day={day}
                  flights={trip.flights}
                  key={day.id}
                  canLock={isOnline && trip.access.canEdit}
                  lockPending={reservationLockMutation.isPending}
                  onMove={setMovingItem}
                  onOpenDocuments={item =>
                    router.push({
                      pathname: '/item-details',
                      params: { kind: 'ACTIVITY', itemId: item.id },
                    })
                  }
                  onToggleLock={item =>
                    reservationLockMutation.mutate({
                      itemId: item.id,
                      locked: !item.reservationLocked,
                    })
                  }
                  onSelect={() => selectTripDay(day.date)}
                  places={trip.places}
                  schedule={trip.schedule}
                  selected={day.date === currentDate}
                />
              ))}
            </View>
          )}

          {movingItem ? (
            <Card>
              <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
                Move {entryTitle(movingItem, trip.places)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {movingItem.startTime
                  ? `Its time stays ${movingItem.startTime}.`
                  : 'It keeps its current place in the day.'}
              </Text>
              <DateChooser
                days={trip.days}
                onSelect={date => {
                  if (date !== movingItem.date)
                    moveScheduleMutation.mutate({ item: movingItem, date });
                }}
                selectedDate={movingItem.date}
              />
              <Button onPress={() => setMovingItem(null)} tone="quiet">
                Cancel
              </Button>
            </Card>
          ) : null}

          <Card>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
              Add a saved place to {selectedDay.label}
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              It is added with a 60-minute duration. Add a start time if you need one.
            </Text>
            <Button
              disabled={!isOnline}
              onPress={() => setShowPlaces(current => !current)}
              tone="secondary"
            >
              {showPlaces ? 'Hide saved places' : 'Choose a saved place'}
            </Button>
            {showPlaces ? (
              trip.places.length ? (
                <View style={{ gap: 8 }}>
                  {trip.places.map(place => (
                    <View
                      key={place.id}
                      style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}
                    >
                      <Text selectable style={{ color: colors.text, flex: 1 }}>
                        {place.name}
                      </Text>
                      <Button
                        accessibilityLabel={`Add ${place.name} to ${selectedDay.label}`}
                        disabled={!isOnline || addPlaceMutation.isPending}
                        loading={addPlaceMutation.isPending}
                        onPress={() =>
                          addPlaceMutation.mutate({ date: currentDate, placeId: place.id })
                        }
                      >
                        Add
                      </Button>
                    </View>
                  ))}
                </View>
              ) : (
                <Text selectable style={{ color: colors.textMuted }}>
                  Save places in Explore before adding them to a day.
                </Text>
              )
            ) : null}
          </Card>
        </>
      )}

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
          Location timeline
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          Create a location across a selected range. The server safely adjusts any overlapping
          location boundaries.
        </Text>
        <Field
          label="New location"
          onChangeText={setLocationName}
          value={locationName}
          placeholder="e.g. Florence"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            onPress={() => setLocationEdge('start')}
            tone={locationEdge === 'start' ? 'primary' : 'secondary'}
          >
            Start: {locationStart ?? 'choose'}
          </Button>
          <Button
            onPress={() => setLocationEdge('end')}
            tone={locationEdge === 'end' ? 'primary' : 'secondary'}
          >
            End: {locationEnd ?? 'choose'}
          </Button>
        </View>
        <DateChooser
          days={trip.days}
          onSelect={date => {
            if (locationEdge === 'start') setLocationStart(date);
            else setLocationEnd(date);
          }}
          selectedDate={locationEdge === 'start' ? (locationStart ?? '') : (locationEnd ?? '')}
        />
        <Button
          disabled={!isOnline || createLocationMutation.isPending}
          loading={createLocationMutation.isPending}
          onPress={() => createLocationMutation.mutate()}
        >
          Create location range
        </Button>
        {createLocationMutation.error ? (
          <Text selectable style={{ color: colors.danger }}>
            {messageFromError(createLocationMutation.error)}
          </Text>
        ) : null}
      </Card>

      {boundaries.length ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
            Location boundaries
          </Text>
          {boundaries.map(boundary => {
            const boundaryId = `${boundary.left.id}:${boundary.right.id}`;
            const editing = activeBoundary === boundaryId;
            return (
              <Card key={boundaryId}>
                <Text selectable style={{ color: colors.text, fontWeight: '800' }}>
                  {boundary.left.locationName} → {boundary.right.locationName}
                </Text>
                <Text selectable style={{ color: colors.textMuted }}>
                  Boundary: {boundary.date}
                </Text>
                <Button
                  disabled={!isOnline}
                  onPress={() => setActiveBoundary(editing ? null : boundaryId)}
                  tone="secondary"
                >
                  {editing ? 'Close boundary editor' : 'Move boundary'}
                </Button>
                {editing ? (
                  <DateChooser
                    days={validBoundaryDates(trip.days, boundary.left, boundary.right)}
                    onSelect={date => boundaryMutation.mutate({ ...boundary, date })}
                    selectedDate={boundary.date}
                  />
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : null}

      {trip.stays.length ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
            Stay date ranges
          </Text>
          {trip.stays.map(stay => (
            <Card key={stay.id}>
              <Text selectable style={{ color: colors.text, fontWeight: '800' }}>
                {stay.name}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {formatDateRange(stay.checkInDate, stay.checkOutDate)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button
                  disabled={!isOnline}
                  onPress={() => setStayDateEdit({ stay, edge: 'checkInDate' })}
                  tone={
                    stayDateEdit?.stay.id === stay.id && stayDateEdit.edge === 'checkInDate'
                      ? 'primary'
                      : 'secondary'
                  }
                >
                  Adjust check-in
                </Button>
                <Button
                  disabled={!isOnline}
                  onPress={() => setStayDateEdit({ stay, edge: 'checkOutDate' })}
                  tone={
                    stayDateEdit?.stay.id === stay.id && stayDateEdit.edge === 'checkOutDate'
                      ? 'primary'
                      : 'secondary'
                  }
                >
                  Adjust check-out
                </Button>
              </View>
              {stayDateEdit?.stay.id === stay.id ? (
                <DateChooser
                  days={trip.days}
                  onSelect={date =>
                    stayDateMutation.mutate({ stay, edge: stayDateEdit.edge, date })
                  }
                  selectedDate={
                    stayDateEdit.edge === 'checkInDate' ? stay.checkInDate : stay.checkOutDate
                  }
                />
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
