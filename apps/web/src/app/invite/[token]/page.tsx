import { InviteRedemption } from '@/features/invite/InviteRedemption';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteRedemption token={token} />;
}
