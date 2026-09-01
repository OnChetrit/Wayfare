import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Reminder } from '@wayfare/domain';
import * as React from 'react';

import { getReminders } from '@/api/trips';
import { tripKeys } from '@/api/query-keys';
import { isSessionInvalidError, WayfareApiError } from '@/api/error';
import { useIsOnline } from '@/api/query-client';
import { useAuth } from '@/features/auth/auth-context';
import { invalidateReminderData } from './reminder-query-invalidation';
import { syncTripReminderNotifications } from './reminder-notifications';

export function useTripReminders(tripId: string | null, status: 'OPEN' | 'COMPLETED') {
  const { signOut } = useAuth();
  const query = useQuery({
    queryKey: tripId ? tripKeys.reminderList(tripId, status) : ['trips', 'none', 'reminders'],
    queryFn: async ({ signal }) => {
      try {
        return await getReminders(tripId!, status, signal);
      } catch (error) {
        if (isSessionInvalidError(error)) await signOut();
        throw error;
      }
    },
    enabled: Boolean(tripId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });

  React.useEffect(() => {
    if (!tripId || status !== 'OPEN' || !query.data) return;
    void syncTripReminderNotifications(tripId, query.data).catch(() => undefined);
  }, [query.data, status, tripId]);

  return query;
}

type ReminderMutationOptions<TData, TVariables> = {
  onSuccess?: (data: TData, variables: TVariables) => Promise<void> | void;
};

/** Mutations for this personal resource intentionally do not invalidate shared trip data. */
export function useReminderMutation<TData, TVariables>(
  tripId: string | null,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: ReminderMutationOptions<TData, TVariables> = {},
) {
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const { signOut } = useAuth();
  return {
    isOnline,
    mutation: useMutation({
      mutationFn: async (variables: TVariables) => {
        if (!isOnline) {
          throw new WayfareApiError(
            'Reconnect to the internet before creating a reminder. Reminders are not queued offline.',
            0,
            'OFFLINE',
          );
        }
        try {
          return await mutationFn(variables);
        } catch (error) {
          if (isSessionInvalidError(error)) await signOut();
          throw error;
        }
      },
      onSuccess: async (data, variables) => {
        await options.onSuccess?.(data, variables);
        await invalidateReminderData(queryClient, tripId);
      },
    }),
  };
}

export function reminderById(reminders: Reminder[] | undefined, reminderId: string | undefined) {
  return reminders?.find(reminder => reminder.id === reminderId) ?? null;
}
