import { router } from 'expo-router';
import * as React from 'react';
import { Alert, Text, View } from 'react-native';

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
  const { trips, selectedTripId, selectTrip, isLoadingTrips, tripsError, refreshTrips } =
    useTrips();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);
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
  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.text, fontSize: 23, fontWeight: '800' }}>
          Account
        </Text>
        <Text selectable style={{ color: colors.textMuted }}>
          {session?.user.email ?? 'Signed in to Wayfare'}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
          Your trips
        </Text>
        {trips.length ? (
          trips.map(trip => (
            <Card key={trip.id}>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {trip.name}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {formatDateRange(trip.startDate, trip.endDate)}
              </Text>
              <Button
                onPress={() => selectTrip(trip.id)}
                tone={trip.id === selectedTripId ? 'primary' : 'secondary'}
              >
                {trip.id === selectedTripId ? 'Selected itinerary' : 'Select trip'}
              </Button>
            </Card>
          ))
        ) : (
          <Card>
            <Text selectable style={{ color: colors.textMuted }}>
              Trips you create or join will appear here.
            </Text>
          </Card>
        )}
      </View>
      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          Preferences
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          Account preferences remain on the web for now. Your selected itinerary syncs across
          devices.
        </Text>
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
