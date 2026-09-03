import CheckIcon from '@expo/material-symbols/check.xml';
import { router, Stack } from 'expo-router';
import {
  Form,
  Host,
  HStack,
  Label,
  ProgressView,
  Section,
  Text as SwiftText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  foregroundStyle,
  keyboardType,
  onSubmit,
  scrollDismissesKeyboard,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import * as React from 'react';
import { ScrollView, Text } from 'react-native';

import { importGoogleMapsList } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { messageFromError } from '@/lib/format';
import { colors as tokenColors, space } from '@/theme/tokens';
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
  const { colors, theme } = useTheme();
  const [url, setUrl] = React.useState('');
  const nativeUrl = useNativeState('');
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

  const importToolbar = (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel={mutation.isPending ? 'Importing list' : 'Import list'}
        disabled={!isOnline || mutation.isPending}
        icon={process.env.EXPO_OS === 'ios' ? 'checkmark' : CheckIcon}
        onPress={() => void importList()}
        tintColor={colors.accent}
        variant="done"
      />
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
                <SwiftText>Reconnect before importing a shared Google Maps list.</SwiftText>
              </Section>
            ) : null}
            <Section
              footer={
                <SwiftText>
                  Paste a public or shared list. Existing places are skipped and new ones appear in
                  your map and saved-place library.
                </SwiftText>
              }
              title="Google Maps list"
            >
              <TextField
                onTextChange={setUrl}
                placeholder="Paste a Google Maps list link"
                text={nativeUrl}
                modifiers={[
                  keyboardType('url'),
                  textContentType('URL'),
                  autocorrectionDisabled(),
                  textInputAutocapitalization('never'),
                  onSubmit(() => void importList()),
                ]}
              />
            </Section>
            {mutation.isPending ? (
              <Section>
                <HStack spacing={8}>
                  <ProgressView />
                  <SwiftText>Importing your list…</SwiftText>
                </HStack>
              </Section>
            ) : null}
            {message ? (
              <Section title={mutation.error ? 'Couldn’t import list' : 'Import complete'}>
                <SwiftText
                  modifiers={[foregroundStyle(mutation.error ? colors.danger : colors.success)]}
                >
                  {message}
                </SwiftText>
              </Section>
            ) : null}
          </Form>
        </Host>
        {importToolbar}
      </>
    );
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: 36 }}
        style={{ backgroundColor: tokenColors.background }}
      >
        <OfflineNotice visible={!isOnline} />
        <Text selectable style={{ color: tokenColors.textMuted, lineHeight: 20 }}>
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
        {mutation.isPending ? (
          <Text selectable style={{ color: tokenColors.textMuted }}>
            Importing your list…
          </Text>
        ) : null}
        {message ? (
          <Text
            selectable
            style={{
              color: mutation.error ? tokenColors.danger : tokenColors.textMuted,
              lineHeight: 20,
            }}
          >
            {message}
          </Text>
        ) : null}
      </ScrollView>
      {importToolbar}
    </>
  );
}
