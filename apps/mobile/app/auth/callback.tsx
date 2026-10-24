import * as Linking from 'expo-linking';
import { Redirect, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { Text, View } from 'react-native';

import { AuthStatusScreen } from '@/components/auth-status-screen';
import { useAuth } from '@/features/auth/auth-context';
import { inviteTokenFromRoute } from '@/features/invite/invite-link';
import { exchangeSessionFromUrl, supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme-provider';

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const {
    code,
    error: authError,
    error_code: errorCode,
    error_description: errorDescription,
    token_hash: tokenHash,
    type,
    inviteToken: rawInviteToken,
  } = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_code?: string | string[];
    error_description?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
    inviteToken?: string | string[];
  }>();
  const { isReady, session } = useAuth();
  const { colors } = useTheme();
  const inviteToken = inviteTokenFromRoute(rawInviteToken);
  const [isCompleting, setIsCompleting] = React.useState(true);
  const [hasEstablishedSession, setHasEstablishedSession] = React.useState(false);
  const [message, setMessage] = React.useState('Completing your secure sign-in…');

  React.useEffect(() => {
    let isMounted = true;

    async function completeAuthentication() {
      const codeFromRoute = getFirstValue(code);
      const tokenHashFromRoute = getFirstValue(tokenHash);
      const typeFromRoute = getFirstValue(type);
      const errorFromRoute = getFirstValue(authError);
      const errorCodeFromRoute = getFirstValue(errorCode);
      const errorDescriptionFromRoute = getFirstValue(errorDescription);
      const hasRouteParameters = Boolean(
        codeFromRoute ||
        tokenHashFromRoute ||
        errorFromRoute ||
        errorCodeFromRoute ||
        errorDescriptionFromRoute,
      );
      const initialUrl = hasRouteParameters ? null : await Linking.getInitialURL();
      const callbackParams = new URLSearchParams();

      if (codeFromRoute) callbackParams.set('code', codeFromRoute);
      if (tokenHashFromRoute) callbackParams.set('token_hash', tokenHashFromRoute);
      if (typeFromRoute) callbackParams.set('type', typeFromRoute);
      if (errorFromRoute) callbackParams.set('error', errorFromRoute);
      if (errorCodeFromRoute) callbackParams.set('error_code', errorCodeFromRoute);
      if (errorDescriptionFromRoute)
        callbackParams.set('error_description', errorDescriptionFromRoute);

      const url = hasRouteParameters
        ? Linking.createURL(`auth/callback?${callbackParams.toString()}`)
        : initialUrl;

      if (!url) {
        if (isMounted) {
          setMessage('We could not find a sign-in link. Please try again.');
          setIsCompleting(false);
        }
        return;
      }

      const exchangeError = await exchangeSessionFromUrl(url);

      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (exchangeError && !activeSession) setMessage(exchangeError.message);
      setHasEstablishedSession(Boolean(activeSession));
      setIsCompleting(false);
    }

    void completeAuthentication();

    return () => {
      isMounted = false;
    };
  }, [authError, code, errorCode, errorDescription, tokenHash, type]);

  if (!isCompleting && isReady && (session || hasEstablishedSession)) {
    if (inviteToken)
      return <Redirect href={{ pathname: '/invite/[token]', params: { token: inviteToken } }} />;
    return <Redirect href="/overview" />;
  }
  if (!isCompleting && isReady) return <Redirect href="/login" />;

  return (
    <AuthStatusScreen>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          One moment
        </Text>
        <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 23 }}>
          {message}
        </Text>
      </View>
    </AuthStatusScreen>
  );
}
