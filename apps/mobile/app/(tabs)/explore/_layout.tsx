import { Stack } from 'expo-router';

import { useTheme } from '@/theme/theme-provider';

export default function ExploreLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.surfaceMuted },
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surfaceMuted },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Explore' }} />
    </Stack>
  );
}
