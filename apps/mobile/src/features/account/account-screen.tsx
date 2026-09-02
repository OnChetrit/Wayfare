import { router } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import {
  Button as SwiftButton,
  Form,
  Host,
  HStack,
  Image as SwiftImage,
  Label,
  Picker,
  ProgressView,
  Section,
  Spacer,
  Text as SwiftText,
  TextField,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled,
  foregroundStyle,
  pickerStyle,
  refreshable,
  scrollDismissesKeyboard,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

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
  const { colors, theme } = useTheme();
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
  const nativeDisplayName = useNativeState(parsedDisplayName);
  const displayNameRef = React.useRef(displayName);
  const preferencesRef = React.useRef(preferences);
  const preferencesRevisionRef = React.useRef(0);
  const isPersistingPreferencesRef = React.useRef(false);
  const preferencesSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnlineRef = React.useRef(isOnline);
  const sessionRef = React.useRef(session);
  isOnlineRef.current = isOnline;
  sessionRef.current = session;

  React.useEffect(
    () => () => {
      if (preferencesSaveTimerRef.current) clearTimeout(preferencesSaveTimerRef.current);
    },
    [],
  );

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

  async function persistPreferenceChanges() {
    const currentSession = sessionRef.current;
    if (!isOnlineRef.current || !currentSession) {
      setPreferencesMessage('Reconnect to save your changes.');
      return;
    }
    if (isPersistingPreferencesRef.current) return;
    const revision = preferencesRevisionRef.current;
    isPersistingPreferencesRef.current = true;
    setIsSavingPreferences(true);
    const error = await updateUserMetadata(
      accountMetadataUpdate(currentSession.user.user_metadata, {
        displayName: displayNameRef.current,
        preferences: preferencesRef.current,
      }),
    );
    isPersistingPreferencesRef.current = false;
    setIsSavingPreferences(false);
    if (preferencesRevisionRef.current > revision) {
      schedulePreferenceSave();
      return;
    }
    setPreferencesMessage(error ? error.message : 'Changes saved.');
  }

  function schedulePreferenceSave() {
    if (preferencesSaveTimerRef.current) clearTimeout(preferencesSaveTimerRef.current);
    if (!isOnlineRef.current || !sessionRef.current) {
      setPreferencesMessage('Reconnect to save your changes.');
      return;
    }
    setPreferencesMessage(null);
    preferencesSaveTimerRef.current = setTimeout(() => {
      preferencesSaveTimerRef.current = null;
      void persistPreferenceChanges();
    }, 600);
  }

  function markPreferencesChanged() {
    preferencesRevisionRef.current += 1;
    schedulePreferenceSave();
  }

  function handleDisplayNameChange(nextDisplayName: string) {
    displayNameRef.current = nextDisplayName;
    setDisplayName(nextDisplayName);
    markPreferencesChanged();
  }

  function handleCurrencyChange(currency: AccountPreferences['currency']) {
    const nextPreferences = { ...preferencesRef.current, currency };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    markPreferencesChanged();
  }

  function handleAppearanceChange(nextTheme: AccountPreferences['theme']) {
    const nextPreferences = { ...preferencesRef.current, theme: nextTheme };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    markPreferencesChanged();
  }

  async function handleSignOut() {
    if (preferencesSaveTimerRef.current) clearTimeout(preferencesSaveTimerRef.current);
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

  if (process.env.EXPO_OS === 'ios') {
    return (
      <Host colorScheme={theme} seedColor={colors.accent} style={{ flex: 1 }}>
        <Form
          modifiers={[
            refreshable(async () => {
              await refreshTrips();
            }),
            scrollDismissesKeyboard('interactively'),
          ]}
        >
          {!isOnline ? (
            <Section title="Connection">
              <Label title="You’re offline" systemImage="wifi.slash" />
              <SwiftText>You can review your account, but changes need a connection.</SwiftText>
            </Section>
          ) : null}

          <Section
            title="Account"
            footer={<SwiftText>Your email address is used to sign you in to Wayfare.</SwiftText>}
          >
            <TextField
              maxLength={120}
              onTextChange={handleDisplayNameChange}
              placeholder="Display name"
              text={nativeDisplayName}
            />
            <Label title={email} systemImage="envelope" />
          </Section>

          <Section
            title="Preferences"
            footer={
              isSavingPreferences ? (
                <HStack spacing={8}>
                  <ProgressView />
                  <SwiftText>Saving changes…</SwiftText>
                </HStack>
              ) : preferencesMessage ? (
                <SwiftText
                  modifiers={[
                    foregroundStyle(
                      preferencesMessage === 'Changes saved.' ? colors.success : colors.danger,
                    ),
                  ]}
                >
                  {preferencesMessage}
                </SwiftText>
              ) : undefined
            }
          >
            <Picker
              label="Currency"
              onSelectionChange={handleCurrencyChange}
              selection={preferences.currency}
              systemImage="banknote"
              modifiers={[pickerStyle('menu')]}
            >
              {currencyOptions.map(currency => (
                <SwiftText key={currency.value} modifiers={[tag(currency.value)]}>
                  {currency.label}
                </SwiftText>
              ))}
            </Picker>
            <Picker
              label="Appearance"
              onSelectionChange={handleAppearanceChange}
              selection={preferences.theme}
              systemImage="circle.lefthalf.filled"
              modifiers={[pickerStyle('segmented')]}
            >
              {appearanceOptions.map(appearance => (
                <SwiftText key={appearance.value} modifiers={[tag(appearance.value)]}>
                  {appearance.label.replace('Use device setting', 'Automatic')}
                </SwiftText>
              ))}
            </Picker>
          </Section>

          <Section
            title="Your trips"
            footer={
              !trips.length && !isLoadingTrips && !tripsError ? (
                <SwiftText>Trips you create or join will appear here.</SwiftText>
              ) : undefined
            }
          >
            {isLoadingTrips ? (
              <HStack spacing={10}>
                <ProgressView />
                <SwiftText>Loading your trips…</SwiftText>
              </HStack>
            ) : null}
            {tripsError ? (
              <VStack alignment="leading" spacing={8}>
                <SwiftText modifiers={[foregroundStyle(colors.danger)]}>
                  {messageFromError(tripsError)}
                </SwiftText>
                <SwiftButton label="Try again" onPress={() => void refreshTrips()} />
              </VStack>
            ) : null}
            {!isLoadingTrips && !tripsError
              ? trips.map(trip => {
                  const isSelected = trip.id === selectedTripId;
                  const isSelecting = trip.id === selectingTripId;
                  return (
                    <SwiftButton
                      key={trip.id}
                      onPress={() => void handleTripSelection(trip.id)}
                      modifiers={[buttonStyle('plain'), disabled(Boolean(selectingTripId))]}
                    >
                      <HStack spacing={12}>
                        <VStack alignment="leading" spacing={2}>
                          <SwiftText>{trip.name}</SwiftText>
                          <SwiftText
                            modifiers={[
                              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                            ]}
                          >
                            {formatDateRange(trip.startDate, trip.endDate)}
                          </SwiftText>
                        </VStack>
                        <Spacer />
                        {isSelecting ? <ProgressView /> : null}
                        {isSelected && !isSelecting ? (
                          <SwiftImage color={colors.accent} systemName="checkmark" />
                        ) : null}
                      </HStack>
                    </SwiftButton>
                  );
                })
              : null}
            <SwiftButton
              label="Create trip"
              systemImage="plus"
              onPress={() => openTripForm('create')}
              modifiers={[disabled(!isOnline)]}
            />
            {tripSelectionError ? (
              <SwiftText modifiers={[foregroundStyle(colors.danger)]}>
                {tripSelectionError}
              </SwiftText>
            ) : null}
          </Section>

          <Section title="Trip settings">
            {!selectedTrip ? (
              <SwiftText>Select a trip to manage its settings.</SwiftText>
            ) : (
              <>
                <Label title={selectedTrip.name} systemImage="suitcase" />
                {ownsSelectedTrip ? (
                  <>
                    <SwiftButton
                      label="Edit trip"
                      systemImage="pencil"
                      onPress={() => openTripForm('edit')}
                      modifiers={[disabled(!isOnline)]}
                    />
                    <SwiftButton
                      label="Manage sharing"
                      systemImage="person.2"
                      onPress={() => router.push('/trip-sharing')}
                      modifiers={[disabled(!isOnline)]}
                    />
                    <SwiftButton
                      label="Delete trip"
                      role="destructive"
                      systemImage="trash"
                      onPress={() => openTripForm('edit')}
                      modifiers={[disabled(!isOnline), tint(colors.danger)]}
                    />
                  </>
                ) : (
                  <SwiftText>
                    Only the trip owner can change trip settings or manage sharing.
                  </SwiftText>
                )}
              </>
            )}
          </Section>

          <Section>
            <SwiftButton
              label={isSigningOut ? 'Logging out…' : 'Log out'}
              role="destructive"
              systemImage="rectangle.portrait.and.arrow.right"
              onPress={() =>
                Alert.alert('Log out?', 'Your secure session will be removed from this device.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out', style: 'destructive', onPress: () => void handleSignOut() },
                ])
              }
              modifiers={[disabled(isSigningOut), tint(colors.danger)]}
            />
            {signOutError ? (
              <SwiftText modifiers={[foregroundStyle(colors.danger)]}>{signOutError}</SwiftText>
            ) : null}
          </Section>
        </Form>
      </Host>
    );
  }

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
            onChangeText={handleDisplayNameChange}
            value={displayName}
          />
          <View style={{ gap: 7 }}>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Preferred currency
            </Text>
            <ChipGroup
              options={[...currencyOptions]}
              value={preferences.currency}
              onChange={handleCurrencyChange}
            />
          </View>
          <View style={{ gap: 7 }}>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Appearance
            </Text>
            <ChipGroup
              options={[...appearanceOptions]}
              value={preferences.theme}
              onChange={handleAppearanceChange}
            />
          </View>
          {isSavingPreferences ? <ActivityIndicator color={colors.accent} /> : null}
          {preferencesMessage ? (
            <Text
              selectable
              style={{
                color: preferencesMessage === 'Changes saved.' ? colors.success : colors.danger,
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
