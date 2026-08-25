import { Stack } from 'expo-router';

export default function ExploreLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: '#102A21' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#102A21' },
        headerTintColor: '#E9F5ED',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Explore' }} />
    </Stack>
  );
}
