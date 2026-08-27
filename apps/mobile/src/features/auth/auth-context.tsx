import type { Session } from '@supabase/supabase-js';
import * as React from 'react';

import { clearLocalSession, supabase } from '@/lib/supabase';

type AuthContextValue = {
  initializationError: string | null;
  isReady: boolean;
  session: Session | null;
  signOut: () => Promise<Error | null>;
  updateUserMetadata: (metadata: Record<string, unknown>) => Promise<Error | null>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [initializationError, setInitializationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      const {
        data: { session: storedSession },
        error,
      } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(storedSession);
      setInitializationError(error?.message ?? null);
      setIsReady(true);
    }
    void restoreSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      if (process.env.NODE_ENV !== 'production') {
        console.info('[auth] state change', {
          event,
          hasSession: Boolean(nextSession),
          expiresAt: nextSession?.expires_at ?? null,
        });
      }
      setSession(nextSession);
      setInitializationError(null);
      setIsReady(true);
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = React.useCallback(async () => {
    const { error } = await clearLocalSession();
    // A rejected/revoked token can make the remote sign-out fail. Either way,
    // this device must leave the authenticated route tree.
    setSession(null);
    setInitializationError(null);
    return error;
  }, []);

  const updateUserMetadata = React.useCallback(async (metadata: Record<string, unknown>) => {
    const { data, error } = await supabase.auth.updateUser({ data: metadata });
    if (error) return error;
    if (data.user) {
      setSession(current => (current ? { ...current, user: data.user } : current));
    }
    return null;
  }, []);

  const value = React.useMemo(
    () => ({ initializationError, isReady, session, signOut, updateUserMetadata }),
    [initializationError, isReady, session, signOut, updateUserMetadata],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = React.use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
