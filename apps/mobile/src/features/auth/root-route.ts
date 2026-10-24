export type RootScreen = 'overview' | 'loading' | 'login';

export function rootScreenForAuth(isReady: boolean, hasSession: boolean): RootScreen {
  if (!isReady) return 'loading';
  return hasSession ? 'overview' : 'login';
}
