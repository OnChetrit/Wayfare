import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';

export default function IndexRoute() {
  const { session } = useAuth();

  return <Redirect href={session ? '/itinerary' : '/login'} />;
}
