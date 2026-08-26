import { Stack } from 'expo-router';

export default function ExploreLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: '#102A21' },
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#102A21' },
        headerTintColor: '#F8F4EB',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Explore' }} />
    </Stack>
  );
}
