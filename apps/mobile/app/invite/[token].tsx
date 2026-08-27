import { useLocalSearchParams } from 'expo-router';

import { InviteRedemptionScreen } from '@/features/invite/invite-redemption-screen';

export default function InviteRoute() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  return <InviteRedemptionScreen token={token} />;
}
