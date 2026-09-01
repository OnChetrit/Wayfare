import AddIcon from '@expo/material-symbols/add.xml';
import CheckIcon from '@expo/material-symbols/check.xml';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import type { PlaceCategory } from '@wayfare/domain';
import {
  assignPlaceToSegment,
  createFlight,
  createPlace,
  createSchedule,
  createStay,
  deleteLocationSegment,
  removePlaceFromSegment,
  searchFlights,
  splitLocationSegment,
  updateDayNotes,
  updateLocationSegment,
  updatePlace,
  updateSchedule,
  updateStay,
} from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import {
  linkHotelToStayForm,
  scheduleInputFromForm,
  stayInputFromForm,
} from '@/features/itinerary/itinerary-editor-form';
import { StayHotelSearch } from '@/features/itinerary/stay-hotel-search';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { TripDetailsSheet, type TripDetailsKind } from '@/features/itinerary/trip-details-sheet';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { formatDate, messageFromError } from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

const placeCategories: { label: string; value: PlaceCategory }[] = [
  { label: 'Hotel', value: 'HOTEL' },
  { label: 'Restaurant', value: 'RESTAURANT' },
  { label: 'Bar', value: 'BAR' },
  { label: 'Café', value: 'CAFE' },
  { label: 'Attraction', value: 'ATTRACTION' },
  { label: 'Shopping', value: 'SHOPPING' },
  { label: 'Transport', value: 'TRANSPORT' },
  { label: 'Custom', value: 'CUSTOM' },
];

const currencyOptions = [
  { label: 'EUR · Euro', value: 'EUR' },
  { label: 'USD · US Dollar', value: 'USD' },
  { label: 'ILS · Shekel', value: 'ILS' },
  { label: 'GBP · Pound', value: 'GBP' },
];

type EditorKind = 'day' | 'flight' | 'place' | 'schedule' | 'segment' | 'stay';

const editorKinds = ['day', 'flight', 'place', 'schedule', 'segment', 'stay'] as const;
const tripDetailsKinds = ['flights', 'locations', 'places', 'stays'] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function titleForKind(kind: EditorKind) {
  return {
    day: 'Day note',
    flight: 'Find a flight',
    place: 'Saved place',
    schedule: 'Itinerary item',
    segment: 'Location',
    stay: 'Stay',
  }[kind];
}

function isEditorKind(kind: string): kind is EditorKind {
  return (editorKinds as readonly string[]).includes(kind);
}

function isTripDetailsKind(kind: string): kind is TripDetailsKind {
  return (tripDetailsKinds as readonly string[]).includes(kind);
}

export function ItineraryEditorSheet() {
  useTheme();
  const params = useLocalSearchParams<{
    kind?: string | string[];
    id?: string | string[];
    date?: string | string[];
    savedPlaceId?: string | string[];
  }>();
  const kind = first(params.kind) ?? 'schedule';
  const itemId = first(params.id);
  const date = first(params.date);
  const savedPlaceId = first(params.savedPlaceId);
  const tripQuery = useTripEditor();

  if (tripQuery.isLoading) return <LoadingState label="Loading editor…" />;
  if (tripQuery.error)
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  if (!tripQuery.data)
    return (
      <EmptyState
        title="No trip selected"
        detail="Choose a trip before adding itinerary details."
        action={<Button onPress={() => router.replace('/trip-form')}>Create trip</Button>}
      />
    );
  if (isTripDetailsKind(kind)) {
    return <TripDetailsSheet initialDate={date} kind={kind} trip={tripQuery.data} />;
  }
  if (!isEditorKind(kind)) {
    return <ErrorState message="This editor is not available." />;
  }

  return (
    <ItineraryEditor
      initialDate={date}
      initialSavedPlaceId={savedPlaceId}
      itemId={itemId}
      kind={kind}
    />
  );
}

function ItineraryEditor({
  kind,
  itemId,
  initialDate,
  initialSavedPlaceId,
}: {
  kind: EditorKind;
  itemId?: string;
  initialDate?: string;
  initialSavedPlaceId?: string;
}) {
  const tripQuery = useTripEditor();
  const trip = tripQuery.data!;
  const isExisting = Boolean(itemId);
  const [message, setMessage] = React.useState<string | null>(null);

  const schedule = trip.schedule.find(item => item.id === itemId);
  const place = trip.places.find(item => item.id === itemId);
  const stay = trip.stays.find(item => item.id === itemId);
  const segment = trip.locationSegments.find(item => item.id === itemId);
  const day =
    trip.days.find(item => item.id === itemId) ?? trip.days.find(item => item.date === initialDate);

  const [scheduleForm, setScheduleForm] = React.useState(() => ({
    date: schedule?.date ?? initialDate ?? trip.days[0]?.date ?? '',
    startTime: schedule?.startTime ?? null,
    duration: String(schedule?.duration ?? 60),
    savedPlaceId: schedule?.savedPlaceId ?? initialSavedPlaceId ?? '',
    title: schedule?.title ?? '',
    category: schedule?.category ?? ('CUSTOM' as PlaceCategory),
    note: schedule?.note ?? '',
    amount: schedule?.amount == null ? '' : String(schedule.amount),
    currency: schedule?.currency ?? trip.defaultCurrency,
  }));
  const [placeForm, setPlaceForm] = React.useState(() => ({
    name: place?.name ?? '',
    category: place?.category ?? ('CUSTOM' as PlaceCategory),
    lat: place ? String(place.lat) : '',
    lng: place ? String(place.lng) : '',
    comment: place?.comment ?? '',
    favorite: Boolean(place?.isFavorite),
  }));
  const [stayForm, setStayForm] = React.useState(() => ({
    name: stay?.name ?? '',
    savedPlaceId: stay?.savedPlaceId ?? '',
    address: stay?.address ?? '',
    locationLabel: stay?.locationLabel ?? trip.destinationLabel ?? '',
    priceAmount: stay?.priceAmount == null ? '' : String(stay.priceAmount),
    priceCurrency: stay?.priceCurrency ?? trip.defaultCurrency,
    cancellationTime: stay?.cancellationTime ?? '',
    checkInDate: stay?.checkInDate ?? initialDate ?? trip.startDate,
    checkOutDate: stay?.checkOutDate ?? trip.endDate,
    notes: stay?.notes ?? '',
    confirmationNumber: stay?.confirmationNumber ?? '',
    secretCode: stay?.secretCode ?? '',
  }));
  const [segmentForm, setSegmentForm] = React.useState(() => ({
    sourceSegmentId: segment?.id ?? trip.locationSegments[0]?.id ?? '',
    locationName: segment?.locationName ?? '',
    country: segment?.country ?? '',
    area: segment?.area ?? '',
    latitude: segment?.latitude == null ? '' : String(segment.latitude),
    longitude: segment?.longitude == null ? '' : String(segment.longitude),
    startDate: segment?.startDate ?? initialDate ?? trip.startDate,
    endDate: segment?.endDate ?? trip.endDate,
  }));
  const [dayNotes, setDayNotes] = React.useState(() => day?.notes ?? '');
  const [flightNumber, setFlightNumber] = React.useState('');
  const [flightDate, setFlightDate] = React.useState(initialDate ?? trip.startDate);
  const [flightResults, setFlightResults] = React.useState<Parameters<typeof createFlight>[1][]>(
    [],
  );

  const { isOnline, mutation: saveSchedule } = useTripMutation(trip.id, async () => {
    const result = scheduleInputFromForm(scheduleForm);
    if ('error' in result) throw new Error(result.error);
    if (schedule) return updateSchedule(trip.id, schedule.id, result.data);
    return createSchedule(trip.id, result.data);
  });
  const { mutation: savePlace } = useTripMutation(trip.id, async () => {
    if (place)
      return updatePlace(trip.id, place.id, {
        isFavorite: placeForm.favorite,
        comment: placeForm.comment,
      });
    const lat = Number(placeForm.lat);
    const lng = Number(placeForm.lng);
    if (!placeForm.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng))
      throw new Error('Enter a place name and valid map coordinates.');
    return createPlace(trip.id, {
      name: placeForm.name.trim(),
      category: placeForm.category,
      lat,
      lng,
    });
  });
  const { mutation: saveStay } = useTripMutation(trip.id, async () => {
    const result = stayInputFromForm(stayForm);
    if ('error' in result) throw new Error(result.error);
    return stay ? updateStay(trip.id, stay.id, result.data) : createStay(trip.id, result.data);
  });
  const { mutation: saveSegment } = useTripMutation(trip.id, async () => {
    if (!segmentForm.locationName.trim()) throw new Error('Enter the location name.');
    const latitude = segmentForm.latitude.trim() ? Number(segmentForm.latitude) : undefined;
    const longitude = segmentForm.longitude.trim() ? Number(segmentForm.longitude) : undefined;
    if (
      (latitude !== undefined && !Number.isFinite(latitude)) ||
      (longitude !== undefined && !Number.isFinite(longitude))
    )
      throw new Error('Enter valid coordinates.');
    if (segment)
      return updateLocationSegment(trip.id, segment.id, {
        locationName: segmentForm.locationName,
        country: segmentForm.country || undefined,
        area: segmentForm.area || undefined,
        latitude,
        longitude,
        startDate: segmentForm.startDate,
        endDate: segmentForm.endDate,
      });
    if (!segmentForm.sourceSegmentId) throw new Error('Choose a location to split.');
    return splitLocationSegment(trip.id, {
      sourceSegmentId: segmentForm.sourceSegmentId,
      splitDate: segmentForm.startDate,
      locationName: segmentForm.locationName,
    });
  });
  const { mutation: saveDay } = useTripMutation(trip.id, () => {
    if (!day) throw new Error('Day not found.');
    return updateDayNotes(trip.id, day.id, dayNotes.trim() || null);
  });
  const { mutation: searchFlightMutation } = useTripMutation(trip.id, async () => {
    if (!flightNumber.trim()) throw new Error('Enter a flight number.');
    const response = await searchFlights(trip.id, flightNumber.trim(), flightDate);
    setFlightResults(response.flights);
    return response;
  });
  const { mutation: addFlightMutation } = useTripMutation(
    trip.id,
    (flight: Parameters<typeof createFlight>[1]) => createFlight(trip.id, flight),
  );
  const { mutation: deleteSegmentMutation } = useTripMutation(trip.id, () =>
    deleteLocationSegment(trip.id, segment!.id),
  );
  const { mutation: assignmentMutation } = useTripMutation(
    trip.id,
    ({ savedPlaceId, assigned }: { savedPlaceId: string; assigned: boolean }) =>
      assigned
        ? removePlaceFromSegment(trip.id, segment!.id, savedPlaceId)
        : assignPlaceToSegment(trip.id, segment!.id, savedPlaceId),
  );

  const activeError = [
    saveSchedule.error,
    savePlace.error,
    saveStay.error,
    saveSegment.error,
    saveDay.error,
    searchFlightMutation.error,
    addFlightMutation.error,
    deleteSegmentMutation.error,
    assignmentMutation.error,
  ].find(Boolean);
  const pending =
    saveSchedule.isPending ||
    savePlace.isPending ||
    saveStay.isPending ||
    saveSegment.isPending ||
    saveDay.isPending;

  async function save() {
    setMessage(null);
    try {
      if (kind === 'schedule') await saveSchedule.mutateAsync(undefined);
      if (kind === 'place') await savePlace.mutateAsync(undefined);
      if (kind === 'stay') await saveStay.mutateAsync(undefined);
      if (kind === 'segment') await saveSegment.mutateAsync(undefined);
      if (kind === 'day') await saveDay.mutateAsync(undefined);
      router.back();
    } catch (error) {
      setMessage(messageFromError(error));
    }
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: 36 }}
        style={{ backgroundColor: colors.background }}
      >
        <OfflineNotice visible={!isOnline} />
        {message || activeError ? (
          <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
            {message ?? messageFromError(activeError)}
          </Text>
        ) : null}
        <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
          {titleForKind(kind)}
        </Text>
        {kind === 'schedule' ? (
          <>
            <Field
              label="Date (YYYY-MM-DD)"
              value={scheduleForm.date}
              onChangeText={date => setScheduleForm(current => ({ ...current, date }))}
            />
            {scheduleForm.startTime === null ? (
              <Button
                onPress={() => setScheduleForm(current => ({ ...current, startTime: '09:00' }))}
                tone="secondary"
              >
                Add a time
              </Button>
            ) : (
              <>
                <Field
                  label="Start time (24 hour)"
                  value={scheduleForm.startTime}
                  onChangeText={startTime =>
                    setScheduleForm(current => ({ ...current, startTime }))
                  }
                  placeholder="09:00"
                />
                <Button
                  onPress={() => setScheduleForm(current => ({ ...current, startTime: null }))}
                  tone="quiet"
                >
                  Clear time
                </Button>
              </>
            )}
            <Field
              label="Duration in minutes"
              keyboardType="number-pad"
              value={scheduleForm.duration}
              onChangeText={duration => setScheduleForm(current => ({ ...current, duration }))}
            />
            <Field
              label="Activity title"
              value={scheduleForm.title}
              onChangeText={title => setScheduleForm(current => ({ ...current, title }))}
              placeholder="Optional when a saved place is selected"
            />
            <Field
              label="Cost (optional)"
              keyboardType="decimal-pad"
              value={scheduleForm.amount}
              onChangeText={amount => setScheduleForm(current => ({ ...current, amount }))}
              placeholder="0.00"
            />
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Currency
            </Text>
            <ChipGroup
              options={currencyOptions}
              value={scheduleForm.currency}
              onChange={currency => setScheduleForm(current => ({ ...current, currency }))}
            />
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Category
            </Text>
            <ChipGroup
              options={placeCategories}
              value={scheduleForm.category}
              onChange={category => setScheduleForm(current => ({ ...current, category }))}
            />
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Saved place
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Button
                onPress={() => setScheduleForm(current => ({ ...current, savedPlaceId: '' }))}
                tone={!scheduleForm.savedPlaceId ? 'primary' : 'secondary'}
              >
                Custom
              </Button>
              {trip.places.map(candidate => (
                <Button
                  key={candidate.id}
                  onPress={() =>
                    setScheduleForm(current => ({ ...current, savedPlaceId: candidate.id }))
                  }
                  tone={candidate.id === scheduleForm.savedPlaceId ? 'primary' : 'secondary'}
                >
                  {candidate.name}
                </Button>
              ))}
            </ScrollView>
            <Field
              label="Notes"
              multiline
              value={scheduleForm.note}
              onChangeText={note => setScheduleForm(current => ({ ...current, note }))}
              placeholder="Reservations, reminders, or directions"
            />
            {schedule?.note?.trim() ? (
              <Button
                disabled={!isOnline}
                onPress={() =>
                  router.push({
                    pathname: '/reminder-editor',
                    params: {
                      scheduleItemId: schedule.id,
                      sourceBody: schedule.note,
                      sourceKind: 'SCHEDULE_ITEM',
                      sourceTitle:
                        schedule.title ??
                        trip.places.find(place => place.id === schedule.savedPlaceId)?.name ??
                        'Activity',
                    },
                  })
                }
                tone="secondary"
              >
                Create reminder from note
              </Button>
            ) : null}
          </>
        ) : null}
        {kind === 'place' ? (
          <>
            <Field
              label="Place name"
              value={placeForm.name}
              editable={!place}
              onChangeText={name => setPlaceForm(current => ({ ...current, name }))}
            />
            {!place ? (
              <>
                <Text
                  selectable
                  style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}
                >
                  Category
                </Text>
                <ChipGroup
                  options={placeCategories}
                  value={placeForm.category}
                  onChange={category => setPlaceForm(current => ({ ...current, category }))}
                />
                <Field
                  label="Latitude"
                  keyboardType="decimal-pad"
                  value={placeForm.lat}
                  onChangeText={lat => setPlaceForm(current => ({ ...current, lat }))}
                />
                <Field
                  label="Longitude"
                  keyboardType="decimal-pad"
                  value={placeForm.lng}
                  onChangeText={lng => setPlaceForm(current => ({ ...current, lng }))}
                />
              </>
            ) : null}
            {place ? (
              <Button
                onPress={() =>
                  setPlaceForm(current => ({ ...current, favorite: !current.favorite }))
                }
                tone={placeForm.favorite ? 'primary' : 'secondary'}
              >
                {placeForm.favorite ? 'Saved as favourite' : 'Mark as favourite'}
              </Button>
            ) : null}
            <Field
              label="Notes"
              multiline
              value={placeForm.comment}
              onChangeText={comment => setPlaceForm(current => ({ ...current, comment }))}
            />
          </>
        ) : null}
        {kind === 'stay' ? (
          <>
            <StayHotelSearch
              destinationLabel={trip.destinationLabel}
              places={trip.places}
              tripId={trip.id}
              onSelect={hotel =>
                setStayForm(current => linkHotelToStayForm(current, hotel, trip.destinationLabel))
              }
            />
            {stayForm.savedPlaceId ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text selectable style={{ color: colors.textMuted, flex: 1 }}>
                  Linked hotel:{' '}
                  {trip.places.find(candidate => candidate.id === stayForm.savedPlaceId)?.name ??
                    stayForm.name}
                </Text>
                <Button
                  accessibilityLabel="Unlink hotel from this stay"
                  onPress={() => setStayForm(current => ({ ...current, savedPlaceId: '' }))}
                  tone="quiet"
                >
                  Unlink
                </Button>
              </View>
            ) : null}
            <Field
              label="Stay name"
              value={stayForm.name}
              onChangeText={name => setStayForm(current => ({ ...current, name }))}
            />
            <Field
              label="Address"
              value={stayForm.address}
              onChangeText={address => setStayForm(current => ({ ...current, address }))}
            />
            <Field
              label="City / area"
              value={stayForm.locationLabel}
              onChangeText={locationLabel =>
                setStayForm(current => ({ ...current, locationLabel }))
              }
            />
            <Field
              label="Check-in (YYYY-MM-DD)"
              value={stayForm.checkInDate}
              onChangeText={checkInDate => setStayForm(current => ({ ...current, checkInDate }))}
            />
            <Field
              label="Check-out (YYYY-MM-DD)"
              value={stayForm.checkOutDate}
              onChangeText={checkOutDate => setStayForm(current => ({ ...current, checkOutDate }))}
            />
            <Field
              label={`Price (${stayForm.priceCurrency})`}
              keyboardType="decimal-pad"
              value={stayForm.priceAmount}
              onChangeText={priceAmount => setStayForm(current => ({ ...current, priceAmount }))}
            />
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Price currency
            </Text>
            <ChipGroup
              options={currencyOptions}
              value={stayForm.priceCurrency}
              onChange={priceCurrency => setStayForm(current => ({ ...current, priceCurrency }))}
            />
            <Field
              label="Cancellation time"
              value={stayForm.cancellationTime}
              onChangeText={cancellationTime =>
                setStayForm(current => ({ ...current, cancellationTime }))
              }
              placeholder="e.g. 18:00 local time"
            />
            <Field
              label="Confirmation number"
              value={stayForm.confirmationNumber}
              onChangeText={confirmationNumber =>
                setStayForm(current => ({ ...current, confirmationNumber }))
              }
            />
            <Field
              label="Access or secret code"
              secureTextEntry
              value={stayForm.secretCode}
              onChangeText={secretCode => setStayForm(current => ({ ...current, secretCode }))}
              placeholder="Door or access code"
            />
            <Field
              label="Notes"
              multiline
              value={stayForm.notes}
              onChangeText={notes => setStayForm(current => ({ ...current, notes }))}
            />
          </>
        ) : null}
        {kind === 'segment' ? (
          <>
            {!segment ? (
              <>
                <Text
                  selectable
                  style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}
                >
                  Split this location
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {trip.locationSegments.map(candidate => (
                    <Button
                      key={candidate.id}
                      onPress={() =>
                        setSegmentForm(current => ({ ...current, sourceSegmentId: candidate.id }))
                      }
                      tone={candidate.id === segmentForm.sourceSegmentId ? 'primary' : 'secondary'}
                    >
                      {candidate.locationName}
                    </Button>
                  ))}
                </ScrollView>
              </>
            ) : null}
            <Field
              label="Location name"
              value={segmentForm.locationName}
              onChangeText={locationName =>
                setSegmentForm(current => ({ ...current, locationName }))
              }
            />
            <Field
              label="Country"
              value={segmentForm.country}
              onChangeText={country => setSegmentForm(current => ({ ...current, country }))}
            />
            <Field
              label="Area"
              value={segmentForm.area}
              onChangeText={area => setSegmentForm(current => ({ ...current, area }))}
            />
            <Field
              label="Start date (YYYY-MM-DD)"
              value={segmentForm.startDate}
              onChangeText={startDate => setSegmentForm(current => ({ ...current, startDate }))}
            />
            {segment ? (
              <Field
                label="End date (YYYY-MM-DD)"
                value={segmentForm.endDate}
                onChangeText={endDate => setSegmentForm(current => ({ ...current, endDate }))}
              />
            ) : null}
            <Field
              label="Latitude"
              keyboardType="decimal-pad"
              value={segmentForm.latitude}
              onChangeText={latitude => setSegmentForm(current => ({ ...current, latitude }))}
            />
            <Field
              label="Longitude"
              keyboardType="decimal-pad"
              value={segmentForm.longitude}
              onChangeText={longitude => setSegmentForm(current => ({ ...current, longitude }))}
            />
            {segment ? (
              <Card>
                <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
                  Places on this map area
                </Text>
                {trip.places.map(candidate => {
                  const assigned = candidate.locationSegmentIds?.includes(segment.id) ?? false;
                  return (
                    <View
                      key={candidate.id}
                      style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}
                    >
                      <Text selectable style={{ color: colors.textMuted, flex: 1 }}>
                        {candidate.name}
                      </Text>
                      <Button
                        disabled={!isOnline || assignmentMutation.isPending}
                        onPress={() =>
                          assignmentMutation.mutate({ savedPlaceId: candidate.id, assigned })
                        }
                        tone={assigned ? 'secondary' : 'primary'}
                      >
                        {assigned ? 'Remove' : 'Assign'}
                      </Button>
                    </View>
                  );
                })}
              </Card>
            ) : null}
          </>
        ) : null}
        {kind === 'day' ? (
          <Field
            label={`Notes for ${day ? formatDate(day.date, { weekday: 'long' }) : 'this day'}`}
            multiline
            value={dayNotes}
            onChangeText={setDayNotes}
          />
        ) : null}
        {kind === 'flight' ? (
          <>
            <Field
              label="Flight number"
              value={flightNumber}
              autoCapitalize="characters"
              onChangeText={setFlightNumber}
              placeholder="LY 315"
            />
            <Field
              label="Departure date (YYYY-MM-DD)"
              value={flightDate}
              onChangeText={setFlightDate}
            />
            <Button
              disabled={!isOnline}
              loading={searchFlightMutation.isPending}
              onPress={() =>
                void searchFlightMutation
                  .mutateAsync(undefined)
                  .catch(error => setMessage(messageFromError(error)))
              }
            >
              Search flights
            </Button>
            {flightResults.map(flight => (
              <Card key={`${flight.flightNumber}-${flight.scheduledDepartureUtc}`}>
                <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
                  {flight.flightNumber} · {flight.airlineName ?? 'Flight'}
                </Text>
                <Text selectable style={{ color: colors.textMuted }}>
                  {flight.scheduledDepartureLocal}
                </Text>
                <Button
                  disabled={!isOnline || addFlightMutation.isPending}
                  loading={addFlightMutation.isPending}
                  onPress={() =>
                    void addFlightMutation
                      .mutateAsync(flight)
                      .then(() => router.back())
                      .catch(error => setMessage(messageFromError(error)))
                  }
                >
                  Add flight
                </Button>
              </Card>
            ))}
          </>
        ) : null}
        {segment ? (
          <Button
            disabled={!isOnline || deleteSegmentMutation.isPending}
            loading={deleteSegmentMutation.isPending}
            onPress={() =>
              Alert.alert(
                'Delete this location?',
                'Assigned places will no longer be associated with this location.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () =>
                      void deleteSegmentMutation.mutateAsync(undefined).then(() => router.back()),
                  },
                ],
              )
            }
            tone="danger"
          >
            Delete location
          </Button>
        ) : null}
      </ScrollView>
      {kind !== 'flight' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={isExisting ? 'Save changes' : 'Add to trip'}
            disabled={!isOnline || pending}
            icon={process.env.EXPO_OS === 'ios' ? undefined : isExisting ? CheckIcon : AddIcon}
            onPress={() => void save()}
            variant="done"
          >
            {isExisting ? 'Save' : 'Add'}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
