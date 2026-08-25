import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { install } from 'react-native-quick-crypto';
import { AppState } from 'react-native';
import { createClient, type EmailOtpType } from '@supabase/supabase-js';

import { shareAuthCodeExchange } from './auth-code-exchange';

// Supabase PKCE requires Web Crypto's `crypto.subtle` for the S256 challenge.
// React Native does not provide it by default, so install the native implementation
// before creating the client.
install();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to apps/mobile/.env.',
  );
}

const secureSessionStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/** Remove this device's persisted session without affecting the user's other devices. */
export async function clearLocalSession() {
  return supabase.auth.signOut({ scope: 'local' });
}

if (process.env.EXPO_OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      return;
    }

    supabase.auth.stopAutoRefresh();
  });
}

const authCodeExchanges = new Map<string, Promise<Error | null>>();

export async function exchangeSessionFromUrl(url: string) {
  const searchParams = new URL(url).searchParams;
  const authorizationError =
    searchParams.get('error_description') ??
    searchParams.get('error') ??
    searchParams.get('error_code');

  if (authorizationError) return new Error(authorizationError);

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });

    return error;
  }

  if (!code) return null;

  // The browser result and Expo Router's deep-link route can arrive together.
  // Share the in-flight exchange so neither caller mistakes a pending session
  // for a completed one and redirects back to login.
  return shareAuthCodeExchange(code, authCodeExchanges, async () => {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error;
  });
}
