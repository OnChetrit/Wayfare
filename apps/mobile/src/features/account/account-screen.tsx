import { router } from 'expo-router';
import * as React from 'react';
import {
  Button as SwiftButton,
  Host,
  HStack,
  Label as SwiftLabel,
  List,
  ProgressView,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled,
  foregroundStyle,
  labelStyle,
  listStyle,
} from '@expo/ui/swift-ui/modifiers';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/features/auth/auth-context';
import { useTrips } from '@/features/trips/trip-context';
import { formatDateRange, messageFromError } from '@/lib/format';
import { colors } from '@/theme/tokens';

export function AccountScreen() {
  const { session, initializationError, signOut } = useAuth();
  const {
    trips,
    selectedTrip,
    selectedTripId,
    selectTrip,
    isLoadingTrips,
    tripsError,
    refreshTrips,
  } = useTrips();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);
  const [selectingTripId, setSelectingTripId] = React.useState<string | null>(null);
  const [tripSelectionError, setTripSelectionError] = React.useState<string | null>(null);

  if (initializationError)
    return <ErrorState title="Couldn’t load your account" message={initializationError} />;
  if (isLoadingTrips) return <LoadingState label="Loading your account…" />;
  if (tripsError)
    return (
      <ErrorState
        title="Couldn’t load your trips"
        message={messageFromError(tripsError)}
        onRetry={() => void refreshTrips()}
      />
    );

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

  if (process.env.EXPO_OS === 'ios') {
    return (
      <Host colorScheme="dark" seedColor={colors.accent} style={{ flex: 1 }}>
        <List modifiers={[listStyle('plain')]}>
          <Section title="Signed in">
            <SwiftText>{email}</SwiftText>
          </Section>
          <Section title="Your trips">
            {trips.length ? (
              trips.map(trip => {
                const isSelected = trip.id === selectedTripId;
                const isSelecting = trip.id === selectingTripId;
                return (
                  <SwiftButton
                    key={trip.id}
                    modifiers={[buttonStyle('plain'), disabled(Boolean(selectingTripId))]}
                    onPress={() => void handleTripSelection(trip.id)}
                  >
                    <HStack spacing={12}>
                      <VStack alignment="leading" spacing={3}>
                        <SwiftText>{trip.name}</SwiftText>
                        <SwiftText>{formatDateRange(trip.startDate, trip.endDate)}</SwiftText>
                      </VStack>
                      <Spacer />
                      {isSelecting ? <ProgressView /> : null}
                      {isSelected && !isSelecting ? (
                        <SwiftLabel
                          modifiers={[labelStyle('iconOnly')]}
                          systemImage="checkmark"
                          title="Selected"
                        />
                      ) : null}
                    </HStack>
                  </SwiftButton>
                );
              })
            ) : (
              <SwiftText>Trips you create or join will appear here.</SwiftText>
            )}
            {tripSelectionError ? (
              <SwiftText modifiers={[foregroundStyle(colors.danger)]}>
                {tripSelectionError}
              </SwiftText>
            ) : null}
            <SwiftButton label="Create trip" onPress={() => openTripForm('create')} />
          </Section>
          <Section title="Trip settings">
            {!selectedTrip ? (
              <SwiftText>Select a trip to manage its settings.</SwiftText>
            ) : (
              <>
                <SwiftText>{selectedTrip.name}</SwiftText>
                <SwiftButton label="Edit trip" onPress={() => openTripForm('edit')} />
                {ownsSelectedTrip ? (
                  <SwiftButton
                    label="Delete trip"
                    onPress={() => openTripForm('edit')}
                    role="destructive"
                  />
                ) : null}
              </>
            )}
          </Section>
          <Section title="Session">
            <SwiftButton
              label={isSigningOut ? 'Logging out…' : 'Log out'}
              modifiers={[disabled(isSigningOut)]}
              onPress={() =>
                Alert.alert('Log out?', 'Your secure session will be removed from this device.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out', style: 'destructive', onPress: () => void handleSignOut() },
                ])
              }
              role="destructive"
            />
            {signOutError ? (
              <SwiftText modifiers={[foregroundStyle(colors.danger)]}>{signOutError}</SwiftText>
            ) : null}
          </Section>
        </List>
      </Host>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.textMuted }}>
          {email}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
          Your trips
        </Text>
        {trips.length ? (
          trips.map(trip => {
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
                  <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
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
        ) : (
          <Card>
            <Text selectable style={{ color: colors.textMuted }}>
              Trips you create or join will appear here.
            </Text>
          </Card>
        )}
        {tripSelectionError ? (
          <Text selectable style={{ color: colors.danger }}>
            {tripSelectionError}
          </Text>
        ) : null}
        <Button onPress={() => openTripForm('create')}>Create trip</Button>
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
                <Button onPress={() => openTripForm('edit')}>Edit trip</Button>
                {ownsSelectedTrip ? (
                  <Button onPress={() => openTripForm('edit')} tone="danger">
                    Delete trip
                  </Button>
                ) : null}
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
