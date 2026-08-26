import { Stack } from 'expo-router';

import { useTrips } from '@/features/trips/trip-context';

export default function ExpensesLayout() {
  const { selectedTrip } = useTrips();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: '#08211C' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#08211C' },
        headerTintColor: '#F8F4EB',
      }}
    >
      <Stack.Screen name="index" options={{ title: selectedTrip?.name ?? 'Expenses' }} />
    </Stack>
  );
}
