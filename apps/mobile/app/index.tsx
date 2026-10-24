import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';
import { rootScreenForAuth } from '@/features/auth/root-route';

export default function IndexRoute() {
  const { isReady, session } = useAuth();
  const rootScreen = rootScreenForAuth(isReady, Boolean(session));

  if (rootScreen === 'loading') return null;
  if (rootScreen === 'overview') return <Redirect href="/overview" />;

  return <Redirect href="/login" />;
}
