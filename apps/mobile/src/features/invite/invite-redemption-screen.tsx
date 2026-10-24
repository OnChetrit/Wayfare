import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import * as React from 'react';
import { Text, View } from 'react-native';

import { isSessionInvalidError } from '@/api/error';
import { redeemTripInvitation } from '@/api/trips';
import { tripKeys } from '@/api/query-keys';
import { useIsOnline } from '@/api/query-client';
import { Button } from '@/components/ui/button';
import { AuthStatusScreen } from '@/components/auth-status-screen';
import { useAuth } from '@/features/auth/auth-context';
import { useTrips } from '@/features/trips/trip-context';
import { messageFromError } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

import { inviteTokenFromRoute } from './invite-link';

export function InviteRedemptionScreen({ token }: { token: string | string[] | undefined }) {
  const { isReady, session, signOut } = useAuth();
  const { selectCreatedTrip } = useTrips();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const [attempt, setAttempt] = React.useState(0);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [message, setMessage] = React.useState('Opening your invitation…');
  const inviteToken = inviteTokenFromRoute(token);

  React.useEffect(() => {
    if (typeof inviteToken !== 'string' || !session || !isOnline) {
      return;
    }
    const tokenToRedeem: string = inviteToken;

    let isActive = true;
    async function redeem() {
      setIsRedeeming(true);
      setMessage('Joining your trip…');
      try {
        const tripId = await redeemTripInvitation(tokenToRedeem);
        await queryClient.invalidateQueries({ queryKey: tripKeys.all });
        await queryClient.refetchQueries({ queryKey: tripKeys.all });
        await selectCreatedTrip(tripId);
        await queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
        if (isActive) router.replace('/overview');
      } catch (error) {
        if (isSessionInvalidError(error)) await signOut();
        if (isActive) setMessage(messageFromError(error, 'This invitation could not be redeemed.'));
      } finally {
        if (isActive) setIsRedeeming(false);
      }
    }

    void redeem();
    return () => {
      isActive = false;
    };
  }, [attempt, inviteToken, isOnline, queryClient, selectCreatedTrip, session, signOut]);

  if (!isReady) return null;
  if (!inviteToken) {
    return (
      <AuthStatusScreen>
        <Text selectable style={{ color: colors.danger, fontSize: 16, lineHeight: 23 }}>
          This invitation link is invalid.
        </Text>
      </AuthStatusScreen>
    );
  }
  if (!session) {
    return <Redirect href={{ pathname: '/login', params: { inviteToken } }} />;
  }

  return (
    <AuthStatusScreen>
      <View style={{ gap: 10 }}>
        <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {isRedeeming ? 'One moment' : 'Trip invitation'}
        </Text>
        <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 23 }}>
          {isOnline ? message : 'Reconnect to the internet before joining this trip.'}
        </Text>
        {!isRedeeming ? (
          <Button disabled={!isOnline} onPress={() => setAttempt(current => current + 1)}>
            Try again
          </Button>
        ) : null}
      </View>
    </AuthStatusScreen>
  );
}
