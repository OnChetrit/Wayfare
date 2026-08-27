import { router } from 'expo-router';
import * as React from 'react';
import { ScrollView, Text } from 'react-native';

import { importGoogleMapsList } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { messageFromError } from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

import { googleMapsImportNotice } from './place-import';

export function PlaceImportSheet() {
  useTheme();
  const tripQuery = useTripEditor();

  if (tripQuery.isLoading) return <LoadingState label="Loading trip…" />;
  if (tripQuery.error) {
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }
  if (!tripQuery.data) {
    return (
      <EmptyState
        title="No trip selected"
        detail="Create or choose a trip before importing places."
        action={<Button onPress={() => router.replace('/trip-form')}>Create trip</Button>}
      />
    );
  }

  return <PlaceImportForm tripId={tripQuery.data.id} />;
}

function PlaceImportForm({ tripId }: { tripId: string }) {
  const [url, setUrl] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const { isOnline, mutation } = useTripMutation(tripId, (listUrl: string) =>
    importGoogleMapsList(tripId, listUrl),
  );

  async function importList() {
    setMessage(null);
    const listUrl = url.trim();
    if (!listUrl) {
      setMessage('Paste a Google Maps shared list link.');
      return;
    }

    try {
      const result = await mutation.mutateAsync(listUrl);
      setMessage(googleMapsImportNotice(result));
    } catch (error) {
      setMessage(messageFromError(error, 'Could not import this Google Maps list.'));
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <OfflineNotice visible={!isOnline} />
      <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
        Paste a public or shared Google Maps list. Existing places are skipped, and new places
        appear in your map and saved-place library.
      </Text>
      <Field
        accessibilityLabel="Google Maps shared list link"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        label="Google Maps shared list link"
        onChangeText={setUrl}
        placeholder="https://maps.app.goo.gl/..."
        value={url}
      />
      <Button
        disabled={!isOnline || mutation.isPending}
        loading={mutation.isPending}
        onPress={() => void importList()}
      >
        Import list
      </Button>
      {message ? (
        <Text
          selectable
          style={{ color: mutation.error ? colors.danger : colors.textMuted, lineHeight: 20 }}
        >
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}
