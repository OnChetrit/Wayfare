import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { AppState } from 'react-native';

import { isAuthenticationError } from '@/api/error';

onlineManager.setEventListener(setOnline =>
  NetInfo.addEventListener(state =>
    setOnline(Boolean(state.isConnected && state.isInternetReachable !== false)),
  ),
);

// React Query's browser focus events do not run in React Native. Tie its focus
// state to the native app lifecycle so stale trip data refreshes after a user
// returns from editing the same trip on the web.
focusManager.setEventListener(setFocused => {
  const subscription = AppState.addEventListener('change', state => {
    setFocused(state === 'active');
  });

  return () => subscription.remove();
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (failureCount, error) => !isAuthenticationError(error) && failureCount < 2,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}

export function WayfareQueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function useIsOnline() {
  const netInfo = useNetInfo();
  return Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
}
