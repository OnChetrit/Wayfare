import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';
import { rootScreenForAuth } from '@/features/auth/root-route';

export default function IndexRoute() {
  const { isReady, session } = useAuth();
  const rootScreen = rootScreenForAuth(isReady, Boolean(session));

  if (rootScreen === 'loading') return null;
  if (rootScreen === 'itinerary') return <Redirect href="/itinerary" />;

  return <Redirect href="/login" />;
}
