import { Stack } from 'expo-router';

import { useTheme } from '@/theme/theme-provider';

export default function OverviewLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Overview' }} />
    </Stack>
  );
}
