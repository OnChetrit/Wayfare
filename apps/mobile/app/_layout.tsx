import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import * as React from 'react';

import { LaunchScreen } from '@/components/launch-screen';
import { WayfareQueryProvider } from '@/api/query-client';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useReminderNotificationNavigation } from '@/features/reminders/reminder-notifications';
import { TripProvider } from '@/features/trips/trip-context';
import { WayfareThemeProvider, useTheme } from '@/theme/theme-provider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <WayfareThemeProvider>
        <WayfareQueryProvider>
          <TripProvider>
            <RootNavigator />
          </TripProvider>
        </WayfareQueryProvider>
      </WayfareThemeProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  useReminderNotificationNavigation();
  const { isReady } = useAuth();
  const { colors } = useTheme();
  const [showLaunchScreen, setShowLaunchScreen] = React.useState(true);
  const [launchStartedAt] = React.useState(() => Date.now());
  const nativeSplashWasHidden = React.useRef(false);

  React.useEffect(() => {
    if (!isReady) return;

    const remainingTime = Math.max(0, 1_150 - (Date.now() - launchStartedAt));
    const timeout = setTimeout(() => setShowLaunchScreen(false), remainingTime);

    return () => clearTimeout(timeout);
  }, [isReady, launchStartedAt]);

  const hideNativeSplash = React.useCallback(() => {
    if (nativeSplashWasHidden.current) return;

    nativeSplashWasHidden.current = true;
    void SplashScreen.hideAsync();
  }, []);

  if (showLaunchScreen) {
    return <LaunchScreen onLayout={hideNativeSplash} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="invite" />
      <Stack.Screen
        name="trip-form"
        options={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          title: 'Trip',
        }}
      />
      <Stack.Screen
        name="trip-sharing"
        options={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          presentation: 'formSheet',
          sheetAllowedDetents: [1],
          sheetGrabberVisible: true,
          title: 'Share trip',
        }}
      />
      <Stack.Screen
        name="expense-editor"
        options={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          presentation: 'formSheet',
          sheetAllowedDetents: [1],
          sheetGrabberVisible: true,
          title: 'Expense',
        }}
      />
      <Stack.Screen
        name="itinerary-editor"
        options={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          title: 'Itinerary',
        }}
      />
      <Stack.Screen
        name="place-actions"
        options={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.48, 0.76],
          sheetGrabberVisible: true,
          sheetLargestUndimmedDetentIndex: 1,
          title: 'Place actions',
        }}
      />
      <Stack.Screen
        name="place-import"
        options={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 0.75],
          sheetGrabberVisible: true,
          title: 'Import places',
        }}
      />
      <Stack.Screen
        name="reminders"
        options={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          title: 'Personal reminders',
        }}
      />
      <Stack.Screen
        name="reminder-editor"
        options={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          title: 'Reminder',
        }}
      />
    </Stack>
  );
}
