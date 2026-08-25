import { Stack } from 'expo-router';

export default function ItineraryLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: '#08211C' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#08211C' },
        headerTintColor: '#F8F4EB',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Itinerary' }} />
    </Stack>
  );
}
