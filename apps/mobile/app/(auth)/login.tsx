import { Redirect, useLocalSearchParams } from 'expo-router';

import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/features/auth/auth-context';
import { inviteTokenFromRoute } from '@/features/invite/invite-link';

export default function LoginScreen() {
  const { isReady, session } = useAuth();
  const { inviteToken: rawInviteToken } = useLocalSearchParams<{
    inviteToken?: string | string[];
  }>();
  const inviteToken = inviteTokenFromRoute(rawInviteToken);

  if (!isReady) return null;
  if (session && inviteToken)
    return <Redirect href={{ pathname: '/invite/[token]', params: { token: inviteToken } }} />;
  if (session) return <Redirect href="/itinerary" />;

  return <AuthForm inviteToken={inviteToken ?? undefined} mode="login" />;
}
