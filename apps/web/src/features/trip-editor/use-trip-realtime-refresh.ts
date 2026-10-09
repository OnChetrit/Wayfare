'use client';

import { useEffect, useRef } from 'react';
import { tripChangedEventSchema } from '@wayfare/domain';
import { createClient } from '@/lib/supabase/client';

const REFRESH_DEBOUNCE_MS = 120;

/**
 * Realtime is a freshness signal only. The callback must re-fetch the trip
 * through the authenticated API instead of trusting data from the broadcast.
 */
export function useTripRealtimeRefresh(tripId: string | undefined, onRefresh: () => void) {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!tripId) return;

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let newestRevision = -1;
    let cancelled = false;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current(), REFRESH_DEBOUNCE_MS);
    };
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;

      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`trip:${tripId}`, { config: { private: true } })
        .on('broadcast', { event: 'trip.changed' }, ({ payload }) => {
          const parsed = tripChangedEventSchema.safeParse(payload);
          if (!parsed.success || parsed.data.tripId !== tripId) return;
          if (parsed.data.revision <= newestRevision) return;
          newestRevision = parsed.data.revision;
          scheduleRefresh();
        })
        .subscribe();
    })();

    window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('online', scheduleRefresh);
    document.addEventListener('visibilitychange', refreshWhenActive);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', scheduleRefresh);
      window.removeEventListener('online', scheduleRefresh);
      document.removeEventListener('visibilitychange', refreshWhenActive);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [tripId]);
}
