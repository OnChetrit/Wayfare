import { Redirect } from 'expo-router';

import { AuthForm } from '@/components/auth-form';
import { useAuth } from '@/features/auth/auth-context';

export default function SignupScreen() {
  const { isReady, session } = useAuth();

  if (!isReady) return null;
  if (session) return <Redirect href="/itinerary" />;

  return <AuthForm mode="signup" />;
}
