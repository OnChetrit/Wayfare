import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isSessionInvalidError, WayfareApiError } from '@/api/error';
import { tripKeys } from '@/api/query-keys';
import { useIsOnline } from '@/api/query-client';
import { useAuth } from '@/features/auth/auth-context';

export function useTripMutation<TData, TVariables>(
  tripId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const { signOut } = useAuth();
  return {
    isOnline,
    mutation: useMutation({
      mutationFn: async (variables: TVariables) => {
        if (!isOnline) {
          throw new WayfareApiError('Reconnect to the internet before saving edits.', 0, 'OFFLINE');
        }
        try {
          return await mutationFn(variables);
        } catch (error) {
          if (isSessionInvalidError(error)) await signOut();
          throw error;
        }
      },
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
          queryClient.invalidateQueries({ queryKey: tripKeys.all }),
        ]);
      },
    }),
  };
}
