import { router } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { useIsOnline } from '@/api/query-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useAuth } from '@/features/auth/auth-context';
import { useTrips } from '@/features/trips/trip-context';
import {
  accountMetadataUpdate,
  accountPreferencesFromMetadata,
  currencyOptions,
  displayNameFromMetadata,
  type AccountPreferences,
} from '@/lib/account-preferences';
import { formatDateRange, messageFromError } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

const appearanceOptions = [
  { label: 'Use device setting', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
] as const;

export function AccountScreen() {
  const { session, initializationError, signOut, updateUserMetadata } = useAuth();
  const {
    trips,
    selectedTrip,
    selectedTripId,
    selectTrip,
    isLoadingTrips,
    tripsError,
    refreshTrips,
  } = useTrips();
  const { colors } = useTheme();
  const isOnline = useIsOnline();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);
  const [selectingTripId, setSelectingTripId] = React.useState<string | null>(null);
  const [tripSelectionError, setTripSelectionError] = React.useState<string | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = React.useState(false);
  const [preferencesMessage, setPreferencesMessage] = React.useState<string | null>(null);
  const metadata = session?.user.user_metadata;
  const fallbackDisplayName = session?.user.email?.split('@')[0] ?? 'Wayfarer';
  const parsedPreferences = React.useMemo(
    () => accountPreferencesFromMetadata(metadata),
    [metadata],
  );
  const parsedDisplayName = React.useMemo(
    () => displayNameFromMetadata(metadata, fallbackDisplayName),
    [fallbackDisplayName, metadata],
  );
  const [displayName, setDisplayName] = React.useState(parsedDisplayName);
  const [preferences, setPreferences] = React.useState<AccountPreferences>(parsedPreferences);

  if (initializationError)
    return <ErrorState title="Couldn’t load your account" message={initializationError} />;

  async function handleTripSelection(tripId: string) {
    if (tripId === selectedTripId || selectingTripId) return;
    setTripSelectionError(null);
    setSelectingTripId(tripId);
    try {
      await selectTrip(tripId);
    } catch (error) {
      setTripSelectionError(messageFromError(error, 'Could not select this trip.'));
    } finally {
      setSelectingTripId(null);
    }
  }

  async function handleSavePreferences() {
    if (!isOnline || !session) return;
    setPreferencesMessage(null);
    setIsSavingPreferences(true);
    const error = await updateUserMetadata(
      accountMetadataUpdate(session.user.user_metadata, { displayName, preferences }),
    );
    setIsSavingPreferences(false);
    setPreferencesMessage(error ? error.message : 'Account preferences saved.');
  }

  async function handleSignOut() {
    setSignOutError(null);
    setIsSigningOut(true);
    const error = await signOut();
    setIsSigningOut(false);
    if (error) {
      setSignOutError(error.message);
      return;
    }
    router.replace('/login');
  }

  const email = session?.user.email ?? 'Signed in to Wayfare';
  const ownsSelectedTrip = selectedTrip?.ownerId === session?.user.id;
  const openTripForm = (mode: 'create' | 'edit') => {
    router.push({ pathname: '/trip-form', params: mode === 'edit' ? { mode } : {} });
  };

  return (
    <Screen>
      <Card>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 3 }}>
            <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              Account & preferences
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              {email}
            </Text>
          </View>
          <OfflineNotice visible={!isOnline} />
          <Field
            accessibilityLabel="Display name"
            autoCapitalize="words"
            label="Display name"
            maxLength={120}
            onChangeText={setDisplayName}
            value={displayName}
          />
          <View style={{ gap: 7 }}>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Preferred currency
            </Text>
            <ChipGroup
              options={[...currencyOptions]}
              value={preferences.currency}
              onChange={currency => setPreferences(current => ({ ...current, currency }))}
            />
          </View>
          <View style={{ gap: 7 }}>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Appearance
            </Text>
            <ChipGroup
              options={[...appearanceOptions]}
              value={preferences.theme}
              onChange={theme => setPreferences(current => ({ ...current, theme }))}
            />
          </View>
          <Button
            disabled={!isOnline || isSavingPreferences}
            loading={isSavingPreferences}
            onPress={() => void handleSavePreferences()}
          >
            Save preferences
          </Button>
          {preferencesMessage ? (
            <Text
              selectable
              style={{
                color:
                  preferencesMessage === 'Account preferences saved.'
                    ? colors.success
                    : colors.danger,
              }}
            >
              {preferencesMessage}
            </Text>
          ) : null}
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
          Your trips
        </Text>
        {isLoadingTrips ? <LoadingState label="Loading your trips…" /> : null}
        {tripsError ? (
          <ErrorState
            title="Couldn’t load your trips"
            message={messageFromError(tripsError)}
            onRetry={() => void refreshTrips()}
          />
        ) : null}
        {!isLoadingTrips && !tripsError && trips.length
          ? trips.map(trip => {
              const isSelected = trip.id === selectedTripId;
              const isSelecting = trip.id === selectingTripId;
              return (
                <Pressable
                  accessibilityLabel={`${isSelected ? 'Selected' : 'Select'} trip ${trip.name}`}
                  accessibilityRole="button"
                  accessibilityState={{
                    busy: isSelecting,
                    disabled: Boolean(selectingTripId),
                    selected: isSelected,
                  }}
                  disabled={Boolean(selectingTripId)}
                  key={trip.id}
                  onPress={() => void handleTripSelection(trip.id)}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderCurve: 'continuous',
                    borderRadius: 14,
                    borderWidth: 1,
                    flexDirection: 'row',
                    gap: 12,
                    opacity: pressed ? 0.72 : 1,
                    padding: 14,
                  })}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      selectable
                      style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
                    >
                      {trip.name}
                    </Text>
                    <Text selectable style={{ color: colors.textMuted }}>
                      {formatDateRange(trip.startDate, trip.endDate)}
                    </Text>
                  </View>
                  {isSelecting ? <ActivityIndicator color={colors.accent} /> : null}
                  {isSelected && !isSelecting ? (
                    <Text
                      selectable
                      style={{ color: colors.accent, fontSize: 22, fontWeight: '800' }}
                    >
                      ✓
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          : null}
        {!isLoadingTrips && !tripsError && !trips.length ? (
          <Card>
            <Text selectable style={{ color: colors.textMuted }}>
              Trips you create or join will appear here.
            </Text>
          </Card>
        ) : null}
        {tripSelectionError ? (
          <Text selectable style={{ color: colors.danger }}>
            {tripSelectionError}
          </Text>
        ) : null}
        <Button disabled={!isOnline} onPress={() => openTripForm('create')}>
          Create trip
        </Button>
      </View>

      <Card>
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            Trip settings
          </Text>
          {!selectedTrip ? (
            <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
              Select a trip to manage its settings.
            </Text>
          ) : (
            <>
              <Text selectable style={{ color: colors.textMuted }}>
                {selectedTrip.name}
              </Text>
              <View style={{ gap: 8 }}>
                {ownsSelectedTrip ? (
                  <>
                    <Button disabled={!isOnline} onPress={() => openTripForm('edit')}>
                      Edit trip
                    </Button>
                    <Button disabled={!isOnline} onPress={() => router.push('/trip-sharing')}>
                      Manage sharing
                    </Button>
                    <Button disabled={!isOnline} onPress={() => openTripForm('edit')} tone="danger">
                      Delete trip
                    </Button>
                  </>
                ) : (
                  <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
                    Only the trip owner can change trip settings or manage sharing.
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </Card>
      <Button
        disabled={isSigningOut}
        loading={isSigningOut}
        onPress={() =>
          Alert.alert('Log out?', 'Your secure session will be removed from this device.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: () => void handleSignOut() },
          ])
        }
        tone="danger"
      >
        Log out
      </Button>
      {signOutError ? (
        <Text selectable style={{ color: colors.danger }}>
          {signOutError}
        </Text>
      ) : null}
    </Screen>
  );
}
