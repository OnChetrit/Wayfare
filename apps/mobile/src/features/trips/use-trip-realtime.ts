import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { tripChangedEventSchema } from '@wayfare/domain';
import { tripKeys } from '@/api/query-keys';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/auth-context';
import { useTrips } from './trip-context';

const DEBOUNCE_MS = 120;

/** Freshness-only trip subscription. Payloads are validated and never contain rows. */
export function useTripRealtime() {
  const { session } = useAuth();
  const { selectedTripId } = useTrips();
  const queryClient = useQueryClient();
  const [presence, setPresence] = React.useState<{ userId: string; displayName: string }[]>([]);

  React.useEffect(() => {
    if (!session || !selectedTripId || !/^[0-9a-f-]{36}$/i.test(selectedTripId)) {
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let newestRevision = -1;
    let pending = false;

    const refresh = () => {
      if (pending) return;
      pending = true;
      timer = setTimeout(() => {
        pending = false;
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: tripKeys.detail(selectedTripId) }),
          queryClient.invalidateQueries({ queryKey: tripKeys.all }),
        ]);
      }, DEBOUNCE_MS);
    };

    void (async () => {
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`trip:${selectedTripId}`, {
          config: { private: true, presence: { key: session.user.id } },
        })
        .on('broadcast', { event: 'trip.changed' }, ({ payload }) => {
          const parsed = tripChangedEventSchema.safeParse(payload);
          if (!parsed.success || parsed.data.tripId !== selectedTripId) return;
          if (parsed.data.revision <= newestRevision) return;
          newestRevision = parsed.data.revision;
          refresh();
        })
        .on('presence', { event: 'sync' }, () => {
          if (!channel) return;
          const state = channel.presenceState<{ userId?: string; displayName?: string }>();
          setPresence(
            Object.values(state)
              .flat()
              .map(item => ({
                userId: item.userId ?? '',
                displayName: item.displayName ?? 'Trip member',
              }))
              .filter(item => item.userId),
          );
        })
        .subscribe(async status => {
          if (status === 'SUBSCRIBED' && channel) {
            await channel.track({
              userId: session.user.id,
              displayName: session.user.user_metadata?.name ?? 'Trip member',
            });
          }
        });
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient, selectedTripId, session]);

  return {
    presence: session && selectedTripId && /^[0-9a-f-]{36}$/i.test(selectedTripId) ? presence : [],
  };
}
