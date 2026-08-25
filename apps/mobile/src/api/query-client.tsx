import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';

import { isAuthenticationError } from '@/api/error';

onlineManager.setEventListener(setOnline =>
  NetInfo.addEventListener(state =>
    setOnline(Boolean(state.isConnected && state.isInternetReachable !== false)),
  ),
);

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
