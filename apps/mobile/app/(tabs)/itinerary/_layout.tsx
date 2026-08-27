import { Stack } from 'expo-router';

import { useTrips } from '@/features/trips/trip-context';
import { useTheme } from '@/theme/theme-provider';

export default function ItineraryLayout() {
  const { selectedTrip } = useTrips();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: selectedTrip?.name ?? 'Itinerary' }} />
      <Stack.Screen name="visual" options={{ title: 'Visual itinerary' }} />
    </Stack>
  );
}
