export type RootScreen = 'itinerary' | 'loading' | 'onboarding';

export function rootScreenForAuth(isReady: boolean, hasSession: boolean): RootScreen {
  if (!isReady) return 'loading';
  return hasSession ? 'itinerary' : 'onboarding';
}
