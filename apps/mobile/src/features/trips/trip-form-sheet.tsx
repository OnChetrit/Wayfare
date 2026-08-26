import type { TripEditorTrip, TripInput, TripSummary } from '@wayfare/domain';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, Text } from 'react-native';

import { createTrip, deleteTrip, updateTrip, type TripSettingsInput } from '@/api/trips';
import { tripKeys } from '@/api/query-keys';
import { Button } from '@/components/ui/button';
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
import { colors, space } from '@/theme/tokens';

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
  const queryClient = useQueryClient();
  const { trips, selectCreatedTrip, reselectAfterTripDeletion } = useTrips();
  const initialForm = React.useMemo<TripFormValues>(
    () => (trip ? tripFormFromTrip(trip) : newTripFormDefaults(defaultCurrency)),
    [defaultCurrency, trip],
  );
  const [form, setForm] = React.useState(initialForm);
  const [message, setMessage] = React.useState<string | null>(null);
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
    const result = validateTripForm(form, defaultTimeZone);
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

  return (
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
      <Field
        accessibilityLabel="Start date in YYYY-MM-DD format"
        label="Start date (YYYY-MM-DD)"
        maxLength={10}
        onChangeText={startDate => update('startDate', startDate)}
        placeholder="2026-07-10"
        value={form.startDate}
      />
      <Field
        accessibilityLabel="End date in YYYY-MM-DD format"
        label="End date (YYYY-MM-DD)"
        maxLength={10}
        onChangeText={endDate => update('endDate', endDate)}
        placeholder="2026-07-16"
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
      <Button
        disabled={!isOnline || isSaving || deleteMutation.isPending}
        loading={isSaving}
        onPress={() => void save()}
      >
        {trip ? 'Save trip' : 'Create trip'}
      </Button>
      {trip && isOwner ? (
        <Button
          disabled={!isOnline || isSaving || deleteMutation.isPending}
          loading={deleteMutation.isPending}
          onPress={confirmDelete}
          tone="danger"
        >
          Delete trip
        </Button>
      ) : null}
      {message || createMutation.error || updateMutation.error || deleteMutation.error ? (
        <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
          {message ??
            messageFromError(createMutation.error ?? updateMutation.error ?? deleteMutation.error)}
        </Text>
      ) : null}
    </ScrollView>
  );
}
