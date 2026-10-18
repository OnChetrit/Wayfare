import AddIcon from '@expo/material-symbols/add.xml';
import CheckIcon from '@expo/material-symbols/check.xml';
import ReminderIcon from '@expo/material-symbols/notifications_active.xml';
import {
  Button as SwiftButton,
  DatePicker,
  Form,
  Host,
  HStack,
  Label,
  Picker,
  Section,
  SecureField,
  Spacer,
  Text as SwiftText,
  TextField,
  Toggle,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  datePickerStyle,
  disabled,
  foregroundStyle,
  keyboardType,
  lineLimit,
  pickerStyle,
  scrollDismissesKeyboard,
  tag,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
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
  updateActivityReservationLock,
  updateDayNotes,
  updateFlight,
  updateLocationSegment,
  updatePlace,
  updateSchedule,
  updateStay,
} from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyPicker } from '@/components/ui/currency-picker';
import { ChipGroup } from '@/components/ui/controls';
import { DateTimeField } from '@/components/ui/date-time-field';
import { dateTimeFieldValue, dateTimePickerDate } from '@/components/ui/date-time-field-value';
import { Field } from '@/components/ui/field';
import { NativeAmountCurrencyField } from '@/components/ui/native-amount-currency-field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import {
  linkHotelToStayForm,
  scheduleInputFromForm,
  stayInputFromForm,
} from '@/features/itinerary/itinerary-editor-form';
import { reminderSourceForSchedule } from '@/features/itinerary/schedule-reminder';
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

type EditorKind = 'day' | 'flight' | 'place' | 'schedule' | 'segment' | 'stay';

const editorKinds = ['day', 'flight', 'place', 'schedule', 'segment', 'stay'] as const;
const tripDetailsKinds = ['flights', 'locations', 'places', 'stays'] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function titleForKind(kind: EditorKind) {
  return {
    day: 'Day note',
    flight: 'Flight',
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
  const { colors: nativeColors, theme } = useTheme();
  const tripQuery = useTripEditor();
  const trip = tripQuery.data!;
  const isExisting = Boolean(itemId);
  const [message, setMessage] = React.useState<string | null>(null);

  const schedule = trip.schedule.find(item => item.id === itemId);
  const place = trip.places.find(item => item.id === itemId);
  const stay = trip.stays.find(item => item.id === itemId);
  const existingFlight =
    kind === 'flight' ? trip.flights.find(item => item.id === itemId) : undefined;
  const segment = trip.locationSegments.find(item => item.id === itemId);
  const day =
    trip.days.find(item => item.id === itemId) ?? trip.days.find(item => item.date === initialDate);
  const scheduleReminder = schedule ? reminderSourceForSchedule(schedule, trip.places) : null;

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
  const [flightNumber, setFlightNumber] = React.useState(existingFlight?.flightNumber ?? '');
  const [flightDate, setFlightDate] = React.useState(
    existingFlight?.departureDate ?? initialDate ?? trip.startDate,
  );
  const [flightResults, setFlightResults] = React.useState<Parameters<typeof createFlight>[1][]>(
    [],
  );
  const nativeScheduleDuration = useNativeState(scheduleForm.duration);
  const nativeScheduleTitle = useNativeState(scheduleForm.title);
  const nativeScheduleAmount = useNativeState(scheduleForm.amount);
  const nativeScheduleNote = useNativeState(scheduleForm.note);
  const nativePlaceName = useNativeState(placeForm.name);
  const nativePlaceLatitude = useNativeState(placeForm.lat);
  const nativePlaceLongitude = useNativeState(placeForm.lng);
  const nativePlaceComment = useNativeState(placeForm.comment);
  const nativeStayName = useNativeState(stayForm.name);
  const nativeStayAddress = useNativeState(stayForm.address);
  const nativeStayLocation = useNativeState(stayForm.locationLabel);
  const nativeStayPrice = useNativeState(stayForm.priceAmount);
  const nativeStayCancellation = useNativeState(stayForm.cancellationTime);
  const nativeStayConfirmation = useNativeState(stayForm.confirmationNumber);
  const nativeStaySecretCode = useNativeState(stayForm.secretCode);
  const nativeStayNotes = useNativeState(stayForm.notes);
  const nativeSegmentName = useNativeState(segmentForm.locationName);
  const nativeSegmentCountry = useNativeState(segmentForm.country);
  const nativeSegmentArea = useNativeState(segmentForm.area);
  const nativeSegmentLatitude = useNativeState(segmentForm.latitude);
  const nativeSegmentLongitude = useNativeState(segmentForm.longitude);
  const nativeDayNotes = useNativeState(dayNotes);
  const nativeFlightNumber = useNativeState(flightNumber);

  const { isOnline, mutation: saveSchedule } = useTripMutation(trip.id, async () => {
    const currentScheduleForm =
      process.env.EXPO_OS === 'ios'
        ? {
            ...scheduleForm,
            amount: nativeScheduleAmount.get(),
            duration: nativeScheduleDuration.get(),
            note: nativeScheduleNote.get(),
            title: nativeScheduleTitle.get(),
          }
        : scheduleForm;
    const result = scheduleInputFromForm(currentScheduleForm);
    if ('error' in result) throw new Error(result.error);
    if (schedule) return updateSchedule(trip.id, schedule.id, result.data);
    return createSchedule(trip.id, result.data);
  });
  const { mutation: savePlace } = useTripMutation(trip.id, async () => {
    const currentPlaceForm =
      process.env.EXPO_OS === 'ios'
        ? {
            ...placeForm,
            comment: nativePlaceComment.get(),
            lat: nativePlaceLatitude.get(),
            lng: nativePlaceLongitude.get(),
            name: nativePlaceName.get(),
          }
        : placeForm;
    if (place)
      return updatePlace(trip.id, place.id, {
        isFavorite: currentPlaceForm.favorite,
        comment: currentPlaceForm.comment,
      });
    const lat = Number(currentPlaceForm.lat);
    const lng = Number(currentPlaceForm.lng);
    if (!currentPlaceForm.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng))
      throw new Error('Enter a place name and valid map coordinates.');
    return createPlace(trip.id, {
      name: currentPlaceForm.name.trim(),
      category: currentPlaceForm.category,
      lat,
      lng,
    });
  });
  const { mutation: saveStay } = useTripMutation(trip.id, async () => {
    const currentStayForm =
      process.env.EXPO_OS === 'ios'
        ? {
            ...stayForm,
            address: nativeStayAddress.get(),
            cancellationTime: nativeStayCancellation.get(),
            confirmationNumber: nativeStayConfirmation.get(),
            locationLabel: nativeStayLocation.get(),
            name: nativeStayName.get(),
            notes: nativeStayNotes.get(),
            priceAmount: nativeStayPrice.get(),
            secretCode: nativeStaySecretCode.get(),
          }
        : stayForm;
    const result = stayInputFromForm(currentStayForm);
    if ('error' in result) throw new Error(result.error);
    return stay ? updateStay(trip.id, stay.id, result.data) : createStay(trip.id, result.data);
  });
  const { mutation: saveSegment } = useTripMutation(trip.id, async () => {
    const currentSegmentForm =
      process.env.EXPO_OS === 'ios'
        ? {
            ...segmentForm,
            area: nativeSegmentArea.get(),
            country: nativeSegmentCountry.get(),
            latitude: nativeSegmentLatitude.get(),
            locationName: nativeSegmentName.get(),
            longitude: nativeSegmentLongitude.get(),
          }
        : segmentForm;
    if (!currentSegmentForm.locationName.trim()) throw new Error('Enter the location name.');
    const latitude = currentSegmentForm.latitude.trim()
      ? Number(currentSegmentForm.latitude)
      : undefined;
    const longitude = currentSegmentForm.longitude.trim()
      ? Number(currentSegmentForm.longitude)
      : undefined;
    if (
      (latitude !== undefined && !Number.isFinite(latitude)) ||
      (longitude !== undefined && !Number.isFinite(longitude))
    )
      throw new Error('Enter valid coordinates.');
    if (segment)
      return updateLocationSegment(trip.id, segment.id, {
        locationName: currentSegmentForm.locationName,
        country: currentSegmentForm.country || undefined,
        area: currentSegmentForm.area || undefined,
        latitude,
        longitude,
        startDate: currentSegmentForm.startDate,
        endDate: currentSegmentForm.endDate,
      });
    if (!currentSegmentForm.sourceSegmentId) throw new Error('Choose a location to split.');
    return splitLocationSegment(trip.id, {
      sourceSegmentId: currentSegmentForm.sourceSegmentId,
      splitDate: currentSegmentForm.startDate,
      locationName: currentSegmentForm.locationName,
    });
  });
  const { mutation: saveDay } = useTripMutation(trip.id, () => {
    if (!day) throw new Error('Day not found.');
    const notes = process.env.EXPO_OS === 'ios' ? nativeDayNotes.get() : dayNotes;
    return updateDayNotes(trip.id, day.id, notes.trim() || null);
  });
  const { mutation: searchFlightMutation } = useTripMutation(trip.id, async () => {
    const number = process.env.EXPO_OS === 'ios' ? nativeFlightNumber.get() : flightNumber;
    if (!number.trim()) throw new Error('Enter a flight number.');
    setFlightResults([]);
    const response = await searchFlights(trip.id, number.trim(), flightDate);
    setFlightResults(response.flights);
    if (!response.flights.length) throw new Error('No flights found for that number and date.');
    return response;
  });
  const { mutation: saveFlightMutation } = useTripMutation(
    trip.id,
    (flight: Parameters<typeof createFlight>[1]) =>
      existingFlight
        ? updateFlight(trip.id, existingFlight.id, flight)
        : createFlight(trip.id, flight),
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
  const { mutation: activityLockMutation } = useTripMutation(trip.id, () => {
    if (!schedule) throw new Error('Activity not found.');
    return updateActivityReservationLock(trip.id, schedule.id, false);
  });

  const activeError = [
    saveSchedule.error,
    savePlace.error,
    saveStay.error,
    saveSegment.error,
    saveDay.error,
    searchFlightMutation.error,
    saveFlightMutation.error,
    deleteSegmentMutation.error,
    assignmentMutation.error,
    activityLockMutation.error,
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

  function selectHotelForStay(hotel: { address?: string; id: string; name: string }) {
    const next = linkHotelToStayForm(stayForm, hotel, trip.destinationLabel);
    setStayForm(next);
    void nativeStayAddress.set(next.address);
    void nativeStayLocation.set(next.locationLabel);
    void nativeStayName.set(next.name);
  }

  if (kind === 'flight' && itemId && !existingFlight) {
    return (
      <ErrorState title="Flight unavailable" message="This flight is no longer in the trip." />
    );
  }

  if (schedule?.reservationLocked) {
    const scheduleTitle =
      schedule.title ||
      trip.places.find(candidate => candidate.id === schedule.savedPlaceId)?.name ||
      'Activity';

    return (
      <>
        <Stack.Screen options={{ title: 'Locked activity' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: 36 }}
          style={{ backgroundColor: nativeColors.background }}
        >
          <OfflineNotice visible={!isOnline} />
          <Card
            accessibilityLabel="Locked activity"
            style={{
              backgroundColor: nativeColors.lockedSurface,
              borderColor: nativeColors.lockedBorder,
            }}
          >
            <Text
              selectable
              style={{ color: nativeColors.locked, fontSize: 17, fontWeight: '800' }}
            >
              🔒 Activity locked
            </Text>
            <Text selectable style={{ color: nativeColors.text, fontSize: 19, fontWeight: '800' }}>
              {scheduleTitle}
            </Text>
            <Text selectable style={{ color: nativeColors.textMuted, lineHeight: 20 }}>
              Unlock this activity before editing its details or schedule.
            </Text>
            <Button
              disabled={!isOnline || !trip.access.canEdit || activityLockMutation.isPending}
              loading={activityLockMutation.isPending}
              onPress={() => activityLockMutation.mutate()}
              tone="secondary"
            >
              Unlock activity
            </Button>
          </Card>
          {activityLockMutation.error ? (
            <Text accessibilityRole="alert" selectable style={{ color: nativeColors.danger }}>
              {messageFromError(activityLockMutation.error)}
            </Text>
          ) : null}
        </ScrollView>
      </>
    );
  }

  if (process.env.EXPO_OS === 'ios') {
    return (
      <>
        <Stack.Screen
          options={{
            title: titleForKind(kind),
          }}
        />
        <Host colorScheme={theme} seedColor={nativeColors.accent} style={{ flex: 1 }}>
          <Form modifiers={[scrollDismissesKeyboard('interactively')]}>
            {!isOnline ? (
              <Section title="Connection">
                <Label title="You’re offline" systemImage="wifi.slash" />
                <SwiftText>Reconnect to update this itinerary.</SwiftText>
              </Section>
            ) : null}

            {message || activeError ? (
              <Section title="Couldn’t save changes">
                <SwiftText modifiers={[foregroundStyle(nativeColors.danger)]}>
                  {message ?? messageFromError(activeError)}
                </SwiftText>
              </Section>
            ) : null}

            {schedule?.reservationLocked ? (
              <Section title="Reservation">
                <Label title="Reservation locked" systemImage="lock.fill" />
                <SwiftText>
                  Changes to this activity require confirmation before they are saved.
                </SwiftText>
              </Section>
            ) : null}

            {itemId && ['schedule', 'stay', 'place', 'flight'].includes(kind) ? (
              <Section title="Files & links">
                <SwiftButton
                  label="View and manage attachments"
                  systemImage="paperclip"
                  onPress={() =>
                    router.push({
                      pathname: '/item-details',
                      params: {
                        itemId,
                        kind: (
                          {
                            schedule: 'ACTIVITY',
                            stay: 'HOTEL',
                            place: 'PLACE',
                            flight: 'FLIGHT',
                          } as Record<string, string>
                        )[kind],
                      },
                    })
                  }
                />
              </Section>
            ) : null}

            {kind === 'schedule' ? (
              <>
                <Section title="When">
                  <DatePicker
                    displayedComponents={['date']}
                    onDateChange={nextDate =>
                      setScheduleForm(current => ({
                        ...current,
                        date: dateTimeFieldValue(nextDate, 'date'),
                      }))
                    }
                    selection={dateTimePickerDate(scheduleForm.date, 'date')}
                    title="Date"
                    modifiers={[datePickerStyle('compact'), disabled(!isOnline || pending)]}
                  />
                  {scheduleForm.startTime === null ? (
                    <SwiftButton
                      label="Add a time"
                      systemImage="clock"
                      modifiers={[disabled(!isOnline || pending)]}
                      onPress={() =>
                        setScheduleForm(current => ({ ...current, startTime: '09:00' }))
                      }
                    />
                  ) : (
                    <>
                      <DatePicker
                        displayedComponents={['hourAndMinute']}
                        onDateChange={nextTime =>
                          setScheduleForm(current => ({
                            ...current,
                            startTime: dateTimeFieldValue(nextTime, 'time'),
                          }))
                        }
                        selection={dateTimePickerDate(scheduleForm.startTime, 'time')}
                        title="Start time"
                        modifiers={[datePickerStyle('compact'), disabled(!isOnline || pending)]}
                      />
                      <SwiftButton
                        label="Clear time"
                        modifiers={[buttonStyle('borderless'), disabled(!isOnline || pending)]}
                        onPress={() =>
                          setScheduleForm(current => ({ ...current, startTime: null }))
                        }
                      />
                    </>
                  )}
                  <TextField
                    onTextChange={duration =>
                      setScheduleForm(current => ({ ...current, duration }))
                    }
                    placeholder="Duration in minutes"
                    text={nativeScheduleDuration}
                    modifiers={[
                      accessibilityLabel('Duration in minutes'),
                      keyboardType('numeric'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                </Section>
                <Section title="Activity">
                  <TextField
                    onTextChange={title => setScheduleForm(current => ({ ...current, title }))}
                    placeholder="Activity title"
                    text={nativeScheduleTitle}
                    modifiers={[
                      accessibilityLabel('Activity title'),
                      textInputAutocapitalization('sentences'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                  <Picker
                    label="Saved place"
                    onSelectionChange={savedPlaceId =>
                      setScheduleForm(current => ({ ...current, savedPlaceId }))
                    }
                    selection={scheduleForm.savedPlaceId}
                    systemImage="mappin.and.ellipse"
                    modifiers={[pickerStyle('navigationLink'), disabled(!isOnline || pending)]}
                  >
                    <SwiftText modifiers={[tag('')]}>Custom activity</SwiftText>
                    {trip.places.map(candidate => (
                      <SwiftText key={candidate.id} modifiers={[tag(candidate.id)]}>
                        {candidate.name}
                      </SwiftText>
                    ))}
                  </Picker>
                  <Picker
                    label="Category"
                    onSelectionChange={category =>
                      setScheduleForm(current => ({ ...current, category }))
                    }
                    selection={scheduleForm.category}
                    systemImage="tag"
                    modifiers={[pickerStyle('navigationLink'), disabled(!isOnline || pending)]}
                  >
                    {placeCategories.map(category => (
                      <SwiftText key={category.value} modifiers={[tag(category.value)]}>
                        {category.label}
                      </SwiftText>
                    ))}
                  </Picker>
                </Section>
                <Section title="Cost">
                  <NativeAmountCurrencyField
                    amount={nativeScheduleAmount}
                    onAmountChange={amount => setScheduleForm(current => ({ ...current, amount }))}
                    currency={scheduleForm.currency}
                    onCurrencyChange={currency =>
                      setScheduleForm(current => ({ ...current, currency }))
                    }
                    label="Cost"
                    placeholder="Amount (optional)"
                    isDisabled={!isOnline || pending}
                  />
                </Section>
                <Section title="Notes">
                  <TextField
                    axis="vertical"
                    onTextChange={note => setScheduleForm(current => ({ ...current, note }))}
                    placeholder="Reservations, reminders, or directions"
                    text={nativeScheduleNote}
                    modifiers={[
                      accessibilityLabel('Notes'),
                      lineLimit({ min: 3, max: 6 }),
                      textInputAutocapitalization('sentences'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                </Section>
              </>
            ) : null}

            {kind === 'place' ? (
              <>
                <Section title="Place details">
                  <TextField
                    autoFocus={!place}
                    onTextChange={name => setPlaceForm(current => ({ ...current, name }))}
                    placeholder="Place name"
                    text={nativePlaceName}
                    modifiers={[
                      accessibilityLabel('Place name'),
                      textInputAutocapitalization('words'),
                      disabled(Boolean(place) || !isOnline || pending),
                    ]}
                  />
                  {!place ? (
                    <Picker
                      label="Category"
                      onSelectionChange={category =>
                        setPlaceForm(current => ({ ...current, category }))
                      }
                      selection={placeForm.category}
                      systemImage="tag"
                      modifiers={[pickerStyle('navigationLink'), disabled(!isOnline || pending)]}
                    >
                      {placeCategories.map(category => (
                        <SwiftText key={category.value} modifiers={[tag(category.value)]}>
                          {category.label}
                        </SwiftText>
                      ))}
                    </Picker>
                  ) : null}
                  {place ? (
                    <Toggle
                      isOn={placeForm.favorite}
                      label="Favourite"
                      systemImage="heart"
                      onIsOnChange={favorite => setPlaceForm(current => ({ ...current, favorite }))}
                      modifiers={[disabled(!isOnline || pending)]}
                    />
                  ) : null}
                </Section>
                {!place ? (
                  <Section title="Map coordinates">
                    <TextField
                      onTextChange={lat => setPlaceForm(current => ({ ...current, lat }))}
                      placeholder="Latitude"
                      text={nativePlaceLatitude}
                      modifiers={[
                        accessibilityLabel('Latitude'),
                        keyboardType('decimal-pad'),
                        disabled(!isOnline || pending),
                      ]}
                    />
                    <TextField
                      onTextChange={lng => setPlaceForm(current => ({ ...current, lng }))}
                      placeholder="Longitude"
                      text={nativePlaceLongitude}
                      modifiers={[
                        accessibilityLabel('Longitude'),
                        keyboardType('decimal-pad'),
                        disabled(!isOnline || pending),
                      ]}
                    />
                  </Section>
                ) : null}
                <Section title="Notes">
                  <TextField
                    axis="vertical"
                    onTextChange={comment => setPlaceForm(current => ({ ...current, comment }))}
                    placeholder="Notes"
                    text={nativePlaceComment}
                    modifiers={[
                      accessibilityLabel('Place notes'),
                      lineLimit({ min: 3, max: 6 }),
                      textInputAutocapitalization('sentences'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                </Section>
              </>
            ) : null}

            {kind === 'stay' ? (
              <>
                <Section
                  footer={
                    <SwiftText>
                      Search Google Maps or link a saved hotel to keep its details attached to this
                      stay.
                    </SwiftText>
                  }
                  title="Hotel"
                >
                  <StayHotelSearch
                    destinationLabel={trip.destinationLabel}
                    places={trip.places}
                    tripId={trip.id}
                    onSelect={selectHotelForStay}
                  />
                  {stayForm.savedPlaceId ? (
                    <SwiftButton
                      label="Unlink hotel"
                      modifiers={[buttonStyle('borderless'), disabled(!isOnline || pending)]}
                      onPress={() => setStayForm(current => ({ ...current, savedPlaceId: '' }))}
                    />
                  ) : null}
                </Section>
                <Section title="Stay details">
                  <TextField
                    onTextChange={name => setStayForm(current => ({ ...current, name }))}
                    placeholder="Stay name"
                    text={nativeStayName}
                    modifiers={[
                      accessibilityLabel('Stay name'),
                      textInputAutocapitalization('words'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                  <TextField
                    onTextChange={address => setStayForm(current => ({ ...current, address }))}
                    placeholder="Address"
                    text={nativeStayAddress}
                    modifiers={[
                      accessibilityLabel('Address'),
                      textInputAutocapitalization('words'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                  <TextField
                    onTextChange={locationLabel =>
                      setStayForm(current => ({ ...current, locationLabel }))
                    }
                    placeholder="City or area"
                    text={nativeStayLocation}
                    modifiers={[
                      accessibilityLabel('City or area'),
                      textInputAutocapitalization('words'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                </Section>
                <Section title="Dates">
                  <DatePicker
                    displayedComponents={['date']}
                    onDateChange={checkInDate =>
                      setStayForm(current => ({
                        ...current,
                        checkInDate: dateTimeFieldValue(checkInDate, 'date'),
                      }))
                    }
                    selection={dateTimePickerDate(stayForm.checkInDate, 'date')}
                    title="Check-in"
                    modifiers={[datePickerStyle('compact'), disabled(!isOnline || pending)]}
                  />
                  <DatePicker
                    displayedComponents={['date']}
                    onDateChange={checkOutDate =>
                      setStayForm(current => ({
                        ...current,
                        checkOutDate: dateTimeFieldValue(checkOutDate, 'date'),
                      }))
                    }
                    selection={dateTimePickerDate(stayForm.checkOutDate, 'date')}
                    title="Check-out"
                    modifiers={[datePickerStyle('compact'), disabled(!isOnline || pending)]}
                  />
                </Section>
                <Section title="Booking">
                  <NativeAmountCurrencyField
                    amount={nativeStayPrice}
                    onAmountChange={priceAmount =>
                      setStayForm(current => ({ ...current, priceAmount }))
                    }
                    currency={stayForm.priceCurrency}
                    onCurrencyChange={priceCurrency =>
                      setStayForm(current => ({ ...current, priceCurrency }))
                    }
                    label="Price"
                    placeholder="Price (optional)"
                    isDisabled={!isOnline || pending}
                  />
                  <DatePicker
                    displayedComponents={['hourAndMinute']}
                    onDateChange={cancellationTime =>
                      setStayForm(current => ({
                        ...current,
                        cancellationTime: dateTimeFieldValue(cancellationTime, 'time'),
                      }))
                    }
                    selection={dateTimePickerDate(stayForm.cancellationTime || '12:00', 'time')}
                    title="Cancellation time"
                    modifiers={[datePickerStyle('compact'), disabled(!isOnline || pending)]}
                  />
                  <TextField
                    onTextChange={confirmationNumber =>
                      setStayForm(current => ({ ...current, confirmationNumber }))
                    }
                    placeholder="Confirmation number"
                    text={nativeStayConfirmation}
                    modifiers={[disabled(!isOnline || pending)]}
                  />
                  <SecureField
                    onTextChange={secretCode =>
                      setStayForm(current => ({ ...current, secretCode }))
                    }
                    placeholder="Access or secret code"
                    text={nativeStaySecretCode}
                    modifiers={[
                      accessibilityLabel('Access or secret code'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                </Section>
                <Section title="Notes">
                  <TextField
                    axis="vertical"
                    onTextChange={notes => setStayForm(current => ({ ...current, notes }))}
                    placeholder="Notes"
                    text={nativeStayNotes}
                    modifiers={[
                      accessibilityLabel('Stay notes'),
                      lineLimit({ min: 3, max: 6 }),
                      textInputAutocapitalization('sentences'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                </Section>
              </>
            ) : null}

            {kind === 'segment' ? (
              <>
                {!segment ? (
                  <Section
                    footer={
                      <SwiftText>Choose the location that this new stop will split.</SwiftText>
                    }
                    title="Split a location"
                  >
                    <Picker
                      label="Location"
                      onSelectionChange={sourceSegmentId =>
                        setSegmentForm(current => ({ ...current, sourceSegmentId }))
                      }
                      selection={segmentForm.sourceSegmentId}
                      systemImage="map"
                      modifiers={[pickerStyle('navigationLink'), disabled(!isOnline || pending)]}
                    >
                      {trip.locationSegments.map(candidate => (
                        <SwiftText key={candidate.id} modifiers={[tag(candidate.id)]}>
                          {candidate.locationName}
                        </SwiftText>
                      ))}
                    </Picker>
                  </Section>
                ) : null}
                <Section title="Location details">
                  <TextField
                    onTextChange={locationName =>
                      setSegmentForm(current => ({ ...current, locationName }))
                    }
                    placeholder="Location name"
                    text={nativeSegmentName}
                    modifiers={[
                      accessibilityLabel('Location name'),
                      textInputAutocapitalization('words'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                  <TextField
                    onTextChange={country => setSegmentForm(current => ({ ...current, country }))}
                    placeholder="Country"
                    text={nativeSegmentCountry}
                    modifiers={[
                      textInputAutocapitalization('words'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                  <TextField
                    onTextChange={area => setSegmentForm(current => ({ ...current, area }))}
                    placeholder="Area"
                    text={nativeSegmentArea}
                    modifiers={[
                      textInputAutocapitalization('words'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                </Section>
                <Section title="Dates">
                  <DatePicker
                    displayedComponents={['date']}
                    onDateChange={startDate =>
                      setSegmentForm(current => ({
                        ...current,
                        startDate: dateTimeFieldValue(startDate, 'date'),
                      }))
                    }
                    selection={dateTimePickerDate(segmentForm.startDate, 'date')}
                    title="Start date"
                    modifiers={[datePickerStyle('compact'), disabled(!isOnline || pending)]}
                  />
                  {segment ? (
                    <DatePicker
                      displayedComponents={['date']}
                      onDateChange={endDate =>
                        setSegmentForm(current => ({
                          ...current,
                          endDate: dateTimeFieldValue(endDate, 'date'),
                        }))
                      }
                      selection={dateTimePickerDate(segmentForm.endDate, 'date')}
                      title="End date"
                      modifiers={[datePickerStyle('compact'), disabled(!isOnline || pending)]}
                    />
                  ) : null}
                </Section>
                <Section title="Map coordinates">
                  <TextField
                    onTextChange={latitude => setSegmentForm(current => ({ ...current, latitude }))}
                    placeholder="Latitude"
                    text={nativeSegmentLatitude}
                    modifiers={[
                      accessibilityLabel('Latitude'),
                      keyboardType('decimal-pad'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                  <TextField
                    onTextChange={longitude =>
                      setSegmentForm(current => ({ ...current, longitude }))
                    }
                    placeholder="Longitude"
                    text={nativeSegmentLongitude}
                    modifiers={[
                      accessibilityLabel('Longitude'),
                      keyboardType('decimal-pad'),
                      disabled(!isOnline || pending),
                    ]}
                  />
                </Section>
                {segment ? (
                  <Section
                    footer={<SwiftText>Places can appear in more than one map area.</SwiftText>}
                    title="Places in this map area"
                  >
                    {trip.places.map(candidate => {
                      const assigned = candidate.locationSegmentIds?.includes(segment.id) ?? false;
                      return (
                        <HStack key={candidate.id} spacing={12}>
                          <Label title={candidate.name} systemImage="mappin" />
                          <Spacer />
                          <SwiftButton
                            label={assigned ? 'Remove' : 'Assign'}
                            modifiers={[
                              buttonStyle('bordered'),
                              disabled(!isOnline || assignmentMutation.isPending),
                            ]}
                            onPress={() =>
                              assignmentMutation.mutate({ savedPlaceId: candidate.id, assigned })
                            }
                          />
                        </HStack>
                      );
                    })}
                  </Section>
                ) : null}
              </>
            ) : null}

            {kind === 'day' ? (
              <Section
                title={day ? `Notes for ${formatDate(day.date, { weekday: 'long' })}` : 'Day notes'}
              >
                <TextField
                  axis="vertical"
                  onTextChange={setDayNotes}
                  placeholder="Add a note for this day"
                  text={nativeDayNotes}
                  modifiers={[
                    accessibilityLabel('Day notes'),
                    lineLimit({ min: 4, max: 8 }),
                    textInputAutocapitalization('sentences'),
                    disabled(!isOnline || pending),
                  ]}
                />
              </Section>
            ) : null}

            {kind === 'flight' ? (
              <>
                <Section title={existingFlight ? 'Find the correct flight' : 'Find a flight'}>
                  {existingFlight ? (
                    <SwiftText>
                      Search by flight number and departure date, then select the correct match to
                      update this saved flight.
                    </SwiftText>
                  ) : null}
                  <TextField
                    autoFocus
                    onTextChange={setFlightNumber}
                    placeholder="Flight number"
                    text={nativeFlightNumber}
                    modifiers={[
                      accessibilityLabel('Flight number'),
                      textInputAutocapitalization('characters'),
                      disabled(!isOnline || !trip.access.canEdit || searchFlightMutation.isPending),
                    ]}
                  />
                  <DatePicker
                    displayedComponents={['date']}
                    onDateChange={departureDate =>
                      setFlightDate(dateTimeFieldValue(departureDate, 'date'))
                    }
                    selection={dateTimePickerDate(flightDate, 'date')}
                    title="Departure date"
                    modifiers={[
                      datePickerStyle('compact'),
                      disabled(!isOnline || !trip.access.canEdit || searchFlightMutation.isPending),
                    ]}
                  />
                  <SwiftButton
                    label={searchFlightMutation.isPending ? 'Searching…' : 'Search flights'}
                    systemImage="magnifyingglass"
                    modifiers={[
                      buttonStyle('borderedProminent'),
                      disabled(!isOnline || !trip.access.canEdit || searchFlightMutation.isPending),
                    ]}
                    onPress={() =>
                      void searchFlightMutation
                        .mutateAsync(undefined)
                        .catch(error => setMessage(messageFromError(error)))
                    }
                  />
                </Section>
                {flightResults.length ? (
                  <Section title="Matches">
                    {flightResults.map(flight => (
                      <VStack
                        key={`${flight.flightNumber}-${flight.scheduledDepartureUtc}`}
                        alignment="leading"
                        spacing={4}
                      >
                        <Label
                          title={`${flight.flightNumber} · ${flight.airlineName ?? 'Flight'}`}
                          systemImage="airplane"
                        />
                        <SwiftText>{flight.scheduledDepartureLocal}</SwiftText>
                        <SwiftButton
                          label={
                            saveFlightMutation.isPending
                              ? 'Saving…'
                              : existingFlight
                                ? 'Use this flight'
                                : 'Add flight'
                          }
                          modifiers={[
                            buttonStyle('bordered'),
                            disabled(
                              !isOnline || !trip.access.canEdit || saveFlightMutation.isPending,
                            ),
                          ]}
                          onPress={() =>
                            void saveFlightMutation
                              .mutateAsync(flight)
                              .then(() => router.back())
                              .catch(error => setMessage(messageFromError(error)))
                          }
                        />
                      </VStack>
                    ))}
                  </Section>
                ) : null}
              </>
            ) : null}

            {segment ? (
              <Section title="Danger zone">
                <SwiftButton
                  label={deleteSegmentMutation.isPending ? 'Deleting…' : 'Delete location'}
                  role="destructive"
                  systemImage="trash"
                  modifiers={[disabled(!isOnline || deleteSegmentMutation.isPending)]}
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
                            void deleteSegmentMutation
                              .mutateAsync(undefined)
                              .then(() => router.back())
                              .catch(error => setMessage(messageFromError(error))),
                        },
                      ],
                    )
                  }
                />
              </Section>
            ) : null}
          </Form>
        </Host>
        {schedule && scheduleReminder ? (
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              accessibilityLabel={`Create a reminder for ${scheduleReminder.sourceTitle}`}
              disabled={!isOnline}
              icon="bell.badge"
              onPress={() =>
                router.push({
                  pathname: '/reminder-editor',
                  params: {
                    remindAtLocal: scheduleReminder.remindAtLocal,
                    scheduleItemId: schedule.id,
                    sourceKind: 'SCHEDULE_ITEM',
                    sourceTitle: scheduleReminder.sourceTitle,
                  },
                })
              }
              tintColor={nativeColors.accent}
            />
          </Stack.Toolbar>
        ) : null}
        {kind !== 'flight' ? (
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              accessibilityLabel={isExisting ? 'Save changes' : 'Add to trip'}
              disabled={!isOnline || pending}
              onPress={() => void save()}
              tintColor={nativeColors.accent}
              variant="done"
            >
              {isExisting ? 'Save' : 'Add'}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        ) : null}
      </>
    );
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
        {schedule?.reservationLocked ? (
          <Card style={{ borderColor: colors.success }}>
            <Text selectable style={{ color: colors.success, fontWeight: '800' }}>
              🔒 Reservation locked
            </Text>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
              Changes to this activity require confirmation before they are saved.
            </Text>
          </Card>
        ) : null}
        {itemId && ['schedule', 'stay', 'place', 'flight'].includes(kind) ? (
          <Button
            onPress={() =>
              router.push({
                pathname: '/item-details',
                params: {
                  itemId,
                  kind: (
                    {
                      schedule: 'ACTIVITY',
                      stay: 'HOTEL',
                      place: 'PLACE',
                      flight: 'FLIGHT',
                    } as Record<string, string>
                  )[kind],
                },
              })
            }
            tone="secondary"
          >
            Files &amp; links
          </Button>
        ) : null}
        {kind === 'schedule' ? (
          <>
            <DateTimeField
              label="Date"
              mode="date"
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
                <DateTimeField
                  label="Start time"
                  mode="time"
                  value={scheduleForm.startTime}
                  onChangeText={startTime =>
                    setScheduleForm(current => ({ ...current, startTime }))
                  }
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
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Cost (optional)"
                  keyboardType="decimal-pad"
                  value={scheduleForm.amount}
                  onChangeText={amount => setScheduleForm(current => ({ ...current, amount }))}
                  placeholder="0.00"
                />
              </View>
              <CurrencyPicker
                value={scheduleForm.currency}
                onChange={currency => setScheduleForm(current => ({ ...current, currency }))}
              />
            </View>
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
            <DateTimeField
              label="Check-in"
              mode="date"
              value={stayForm.checkInDate}
              onChangeText={checkInDate => setStayForm(current => ({ ...current, checkInDate }))}
            />
            <DateTimeField
              label="Check-out"
              mode="date"
              value={stayForm.checkOutDate}
              onChangeText={checkOutDate => setStayForm(current => ({ ...current, checkOutDate }))}
            />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Price"
                  keyboardType="decimal-pad"
                  value={stayForm.priceAmount}
                  onChangeText={priceAmount =>
                    setStayForm(current => ({ ...current, priceAmount }))
                  }
                />
              </View>
              <CurrencyPicker
                value={stayForm.priceCurrency}
                onChange={priceCurrency => setStayForm(current => ({ ...current, priceCurrency }))}
              />
            </View>
            <DateTimeField
              label="Cancellation time"
              mode="time"
              value={stayForm.cancellationTime}
              onChangeText={cancellationTime =>
                setStayForm(current => ({ ...current, cancellationTime }))
              }
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
            <DateTimeField
              label="Start date"
              mode="date"
              value={segmentForm.startDate}
              onChangeText={startDate => setSegmentForm(current => ({ ...current, startDate }))}
            />
            {segment ? (
              <DateTimeField
                label="End date"
                mode="date"
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
            {existingFlight ? (
              <Text selectable style={{ color: colors.textMuted }}>
                Search by flight number and departure date, then select the correct match to update
                this saved flight.
              </Text>
            ) : null}
            <Field
              label="Flight number"
              value={flightNumber}
              autoCapitalize="characters"
              onChangeText={setFlightNumber}
              placeholder="LY 315"
            />
            <DateTimeField
              label="Departure date"
              mode="date"
              value={flightDate}
              onChangeText={setFlightDate}
            />
            <Button
              disabled={!isOnline || !trip.access.canEdit}
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
                  disabled={!isOnline || !trip.access.canEdit || saveFlightMutation.isPending}
                  loading={saveFlightMutation.isPending}
                  onPress={() =>
                    void saveFlightMutation
                      .mutateAsync(flight)
                      .then(() => router.back())
                      .catch(error => setMessage(messageFromError(error)))
                  }
                >
                  {existingFlight ? 'Use this flight' : 'Add flight'}
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
      {schedule && scheduleReminder ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel={`Create a reminder for ${scheduleReminder.sourceTitle}`}
            disabled={!isOnline}
            icon={process.env.EXPO_OS === 'ios' ? 'bell.badge' : ReminderIcon}
            onPress={() =>
              router.push({
                pathname: '/reminder-editor',
                params: {
                  remindAtLocal: scheduleReminder.remindAtLocal,
                  scheduleItemId: schedule.id,
                  sourceKind: 'SCHEDULE_ITEM',
                  sourceTitle: scheduleReminder.sourceTitle,
                },
              })
            }
            tintColor={colors.accent}
          />
        </Stack.Toolbar>
      ) : null}
      {kind !== 'flight' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={isExisting ? 'Save changes' : 'Add to trip'}
            disabled={!isOnline || pending}
            icon={process.env.EXPO_OS === 'ios' ? undefined : isExisting ? CheckIcon : AddIcon}
            onPress={() => void save()}
            tintColor={colors.accent}
            variant="done"
          >
            {isExisting ? 'Save' : 'Add'}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
