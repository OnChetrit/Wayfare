export type RootScreen = 'itinerary' | 'loading' | 'login';

export function rootScreenForAuth(isReady: boolean, hasSession: boolean): RootScreen {
  if (!isReady) return 'loading';
  return hasSession ? 'itinerary' : 'login';
}
