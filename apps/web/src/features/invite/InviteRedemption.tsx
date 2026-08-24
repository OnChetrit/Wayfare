'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type InviteRedemptionProps = { token: string };

export function InviteRedemption({ token }: InviteRedemptionProps) {
  const router = useRouter();
  const [message, setMessage] = useState('Opening your invitation…');

  useEffect(() => {
    let active = true;
    async function redeem() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      const { data: tripId, error } = await supabase.rpc('redeem_trip_invitation', {
        invitation_token: token,
      });
      if (error || !tripId) {
        if (active) setMessage(error?.message ?? 'This invitation could not be redeemed.');
        return;
      }
      router.replace(`/editor?trip=${encodeURIComponent(tripId)}`);
    }
    void redeem();
    return () => {
      active = false;
    };
  }, [router, token]);

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <p>{message}</p>
    </main>
  );
}
