'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type InviteRedemptionProps = { token: string };

export function InviteRedemption({ token }: InviteRedemptionProps) {
  const router = useRouter();
  const [message, setMessage] = useState('Opening your invitation…');

  useEffect(() => {
    let active = true;
    async function redeem() {
      try {
        const response = await fetch('/api/invitations/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: unknown;
          tripId?: string;
        };
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
          return;
        }
        if (!response.ok || !payload.tripId) {
          const message =
            typeof payload.error === 'string'
              ? payload.error
              : 'This invitation could not be redeemed.';
          if (active) setMessage(message);
          return;
        }
        router.refresh();
        router.replace(`/editor?trip=${encodeURIComponent(payload.tripId)}`);
      } catch {
        if (active) setMessage('This invitation could not be redeemed. Please try again.');
        return;
      }
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
