import type { TripEditorTrip, TripInput, TripSummary } from '@wayfare/domain';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import {
  Button as SwiftButton,
  ConfirmationDialog,
  DatePicker,
  Form,
  Host,
  Label,
  Section,
  Text as SwiftText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  datePickerStyle,
  disabled,
  foregroundStyle,
  scrollDismissesKeyboard,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';

import { createTrip, deleteTrip, updateTrip, type TripSettingsInput } from '@/api/trips';
import { tripKeys } from '@/api/query-keys';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { dateTimeFieldValue, dateTimePickerDate } from '@/components/ui/date-time-field-value';
import { Field } from '@/components/ui/field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useAuth } from '@/features/auth/auth-context';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import {
  deviceTimeZone,
  newTripFormDefaults,
  tripFormFromTrip,
  validateTripForm,
  type TripFormValues,
} from '@/features/trips/trip-form';
import { useTrips } from '@/features/trips/trip-context';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { messageFromError } from '@/lib/format';
import { preferredCurrency } from '@/lib/user-preferences';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

type TripFormMode = 'create' | 'edit';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function tripSettingsFromInput(input: TripInput): TripSettingsInput {
  return {
    name: input.name,
    destinationLabel: input.destinationLabel ?? null,
    startDate: input.startDate,
    endDate: input.endDate,
    defaultTimeZone: input.defaultTimeZone,
    defaultCurrency: input.defaultCurrency,
  };
}

export function TripFormSheet() {
  const { mode: rawMode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode: TripFormMode = first(rawMode) === 'edit' ? 'edit' : 'create';
  const { session } = useAuth();
  const tripQuery = useTripEditor();
  const preferredDefaultCurrency = preferredCurrency(session?.user.user_metadata, 'EUR');

  if (mode === 'edit' && tripQuery.isLoading) return <LoadingState label="Loading trip…" />;
  if (mode === 'edit' && tripQuery.error) {
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }
  if (mode === 'edit' && !tripQuery.data) {
    return (
      <EmptyState
        title="No trip selected"
        detail="Choose a trip before editing its settings."
        action={<Button onPress={() => router.replace('/trip-form')}>Create trip</Button>}
      />
    );
  }

  return (
    <TripForm
      defaultCurrency={preferredDefaultCurrency}
      key={`${mode}:${tripQuery.data?.id ?? preferredDefaultCurrency}`}
      mode={mode}
      trip={mode === 'edit' ? tripQuery.data : null}
    />
  );
}

function TripForm({
  defaultCurrency,
  mode,
  trip,
}: {
  defaultCurrency: string;
  mode: TripFormMode;
  trip: TripEditorTrip | null | undefined;
}) {
  const { session } = useAuth();
  const { colors, theme } = useTheme();
  const queryClient = useQueryClient();
  const { trips, selectCreatedTrip, reselectAfterTripDeletion } = useTrips();
  const initialForm = React.useMemo<TripFormValues>(
    () => (trip ? tripFormFromTrip(trip) : newTripFormDefaults(defaultCurrency)),
    [defaultCurrency, trip],
  );
  const [form, setForm] = React.useState(initialForm);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isDeleteConfirmationPresented, setIsDeleteConfirmationPresented] = React.useState(false);
  const nativeName = useNativeState(initialForm.name);
  const nativeDestination = useNativeState(initialForm.destinationLabel);
  const nativeCurrency = useNativeState(initialForm.defaultCurrency);
  const defaultTimeZone = trip?.defaultTimeZone ?? deviceTimeZone();
  const tripSummary = trips.find(candidate => candidate.id === trip?.id);
  const isOwner = tripSummary?.ownerId === session?.user.id;

  const { isOnline, mutation: createMutation } = useTripMutation(
    null,
    (input: TripInput) => createTrip(input),
    {
      onSuccess: async createdTrip => {
        queryClient.setQueryData<TripSummary[]>(tripKeys.all, current => [
          ...(current ?? []).filter(tripSummary => tripSummary.id !== createdTrip.id),
          createdTrip,
        ]);
        await selectCreatedTrip(createdTrip.id);
        await queryClient.invalidateQueries({ queryKey: tripKeys.detail(createdTrip.id) });
      },
    },
  );
  const { mutation: updateMutation } = useTripMutation(
    trip?.id ?? null,
    (input: TripSettingsInput) => {
      if (!trip) throw new Error('Choose a trip before saving its settings.');
      return updateTrip(trip.id, input);
    },
  );
  const { mutation: deleteMutation } = useTripMutation(
    trip?.id ?? null,
    () => {
      if (!trip) throw new Error('Choose a trip before deleting it.');
      return deleteTrip(trip.id);
    },
    {
      onSuccess: async () => {
        if (!trip) return;
        const remainingTrips = trips.filter(candidate => candidate.id !== trip.id);
        queryClient.setQueryData<TripSummary[]>(tripKeys.all, remainingTrips);
        queryClient.removeQueries({ queryKey: tripKeys.detail(trip.id) });
        await reselectAfterTripDeletion(trip.id, remainingTrips);
      },
    },
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function update<K extends keyof TripFormValues>(key: K, value: TripFormValues[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function save() {
    const currentForm =
      process.env.EXPO_OS === 'ios'
        ? {
            ...form,
            defaultCurrency: nativeCurrency.get(),
            destinationLabel: nativeDestination.get(),
            name: nativeName.get(),
          }
        : form;
    const result = validateTripForm(currentForm, defaultTimeZone);
    if ('error' in result) {
      setMessage(result.error);
      return;
    }

    setMessage(null);
    try {
      if (trip) {
        await updateMutation.mutateAsync(tripSettingsFromInput(result.data));
      } else {
        await createMutation.mutateAsync(result.data);
      }
      router.back();
    } catch (error) {
      setMessage(messageFromError(error, `Could not ${mode === 'edit' ? 'save' : 'create'} trip.`));
    }
  }

  function confirmDelete() {
    if (!trip) return;
    Alert.alert(
      `Delete ${trip.name}?`,
      'This permanently removes its itinerary, places, stays, flights, and expenses.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete trip',
          style: 'destructive',
          onPress: () =>
            void deleteMutation
              .mutateAsync(undefined)
              .then(() => router.back())
              .catch(error => setMessage(messageFromError(error, 'Could not delete this trip.'))),
        },
      ],
    );
  }

  function deleteTripAndClose() {
    void deleteMutation
      .mutateAsync(undefined)
      .then(() => router.back())
      .catch(error => setMessage(messageFromError(error, 'Could not delete this trip.')));
  }

  const isFormDisabled = !isOnline || isSaving || deleteMutation.isPending;
  const formError =
    message ||
    (createMutation.error || updateMutation.error || deleteMutation.error
      ? messageFromError(createMutation.error ?? updateMutation.error ?? deleteMutation.error)
      : null);
  const toolbar = trip ? (
    <Stack.Toolbar placement="right">
      {isOwner && process.env.EXPO_OS !== 'ios' ? (
        <Stack.Toolbar.Button
          accessibilityLabel="Delete trip"
          disabled={isFormDisabled}
          onPress={confirmDelete}
          tintColor={colors.danger}
        >
          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        </Stack.Toolbar.Button>
      ) : null}
      <Stack.Toolbar.Button
        accessibilityLabel="Save trip"
        disabled={isFormDisabled}
        onPress={() => void save()}
        tintColor={colors.accent}
        variant="done"
      >
        {isSaving ? 'Saving…' : 'Save'}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  ) : (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel="Create trip"
        disabled={!isOnline || isSaving}
        onPress={() => void save()}
        tintColor={colors.accent}
        variant="done"
      >
        {isSaving ? 'Creating…' : 'Create trip'}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );

  if (process.env.EXPO_OS === 'ios') {
    return (
      <>
        <Host colorScheme={theme} seedColor={colors.accent} style={{ flex: 1 }}>
          <Form modifiers={[scrollDismissesKeyboard('interactively')]}>
            {!isOnline ? (
              <Section title="Connection">
                <Label title="You’re offline" systemImage="wifi.slash" />
                <SwiftText>Reconnect to save changes to this trip.</SwiftText>
              </Section>
            ) : null}

            <Section
              title="Trip details"
              footer={
                <SwiftText>
                  {trip
                    ? 'Update the essentials for this trip.'
                    : 'Start with the essentials. You can fill in the itinerary afterward.'}
                </SwiftText>
              }
            >
              <TextField
                maxLength={80}
                onTextChange={name => update('name', name)}
                placeholder="Trip name"
                text={nativeName}
                modifiers={[textInputAutocapitalization('sentences'), disabled(isFormDisabled)]}
              />
              <TextField
                maxLength={120}
                onTextChange={destinationLabel => update('destinationLabel', destinationLabel)}
                placeholder="Destination"
                text={nativeDestination}
                modifiers={[textInputAutocapitalization('words'), disabled(isFormDisabled)]}
              />
            </Section>

            <Section title="Dates">
              <DatePicker
                displayedComponents={['date']}
                onDateChange={startDate =>
                  update('startDate', dateTimeFieldValue(startDate, 'date'))
                }
                selection={dateTimePickerDate(form.startDate, 'date')}
                title="Start date"
                modifiers={[datePickerStyle('compact'), disabled(isFormDisabled)]}
              />
              <DatePicker
                displayedComponents={['date']}
                onDateChange={endDate => update('endDate', dateTimeFieldValue(endDate, 'date'))}
                selection={dateTimePickerDate(form.endDate, 'date')}
                title="End date"
                modifiers={[datePickerStyle('compact'), disabled(isFormDisabled)]}
              />
            </Section>

            <Section title="Default currency">
              <TextField
                maxLength={3}
                onTextChange={defaultCurrency => update('defaultCurrency', defaultCurrency)}
                placeholder="EUR"
                text={nativeCurrency}
                modifiers={[textInputAutocapitalization('characters'), disabled(isFormDisabled)]}
              />
            </Section>

            {formError ? (
              <Section title="Couldn’t save trip">
                <SwiftText modifiers={[foregroundStyle(colors.danger)]}>{formError}</SwiftText>
              </Section>
            ) : null}

            {trip && isOwner ? (
              <Section title="Danger zone">
                <ConfirmationDialog
                  isPresented={isDeleteConfirmationPresented}
                  onIsPresentedChange={setIsDeleteConfirmationPresented}
                  title={`Delete ${trip.name}?`}
                  titleVisibility="visible"
                >
                  <ConfirmationDialog.Trigger>
                    <SwiftButton
                      label="Delete trip"
                      role="destructive"
                      systemImage="trash"
                      onPress={() => setIsDeleteConfirmationPresented(true)}
                      modifiers={[disabled(isFormDisabled)]}
                    />
                  </ConfirmationDialog.Trigger>
                  <ConfirmationDialog.Actions>
                    <SwiftButton
                      label="Delete trip"
                      role="destructive"
                      onPress={deleteTripAndClose}
                    />
                    <SwiftButton label="Cancel" role="cancel" />
                  </ConfirmationDialog.Actions>
                  <ConfirmationDialog.Message>
                    <SwiftText>
                      This permanently removes its itinerary, places, stays, flights, and expenses.
                    </SwiftText>
                  </ConfirmationDialog.Message>
                </ConfirmationDialog>
              </Section>
            ) : null}
          </Form>
        </Host>
        {toolbar}
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
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          {trip
            ? 'Update the essentials for this trip.'
            : 'Start with the essentials. You can fill in the itinerary afterward.'}
        </Text>
        <Field
          accessibilityLabel="Trip name"
          autoCapitalize="sentences"
          label="Trip name"
          maxLength={80}
          onChangeText={name => update('name', name)}
          placeholder="Summer city break"
          value={form.name}
        />
        <Field
          accessibilityLabel="Destination"
          autoCapitalize="words"
          label="Destination"
          maxLength={120}
          onChangeText={destinationLabel => update('destinationLabel', destinationLabel)}
          placeholder="Lisbon"
          value={form.destinationLabel}
        />
        <DateTimeField
          label="Start date"
          mode="date"
          onChangeText={startDate => update('startDate', startDate)}
          value={form.startDate}
        />
        <DateTimeField
          label="End date"
          mode="date"
          onChangeText={endDate => update('endDate', endDate)}
          value={form.endDate}
        />
        <Field
          accessibilityLabel="Default currency"
          autoCapitalize="characters"
          label="Default currency"
          maxLength={3}
          onChangeText={defaultCurrency => update('defaultCurrency', defaultCurrency)}
          placeholder="EUR"
          value={form.defaultCurrency}
        />
        {formError ? (
          <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
            {formError}
          </Text>
        ) : null}
      </ScrollView>
      {toolbar}
    </>
  );
}
