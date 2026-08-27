import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/theme/theme-provider';

export default function TabsLayout() {
  const { isReady, session } = useAuth();
  const { colors, theme } = useTheme();
  if (!isReady) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      iconColor={{ default: colors.textMuted, selected: colors.accent }}
      labelStyle={{ default: { color: colors.textMuted }, selected: { color: colors.accent } }}
      tintColor={colors.accent}
      {...(theme === 'dark' ? { blurEffect: 'systemMaterialDark' as const } : {})}
    >
      <NativeTabs.Trigger name="itinerary">
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle.fill" md="format_list_bulleted" />
        <NativeTabs.Trigger.Label>Itinerary</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="map.fill" md="map" />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Icon sf="receipt.fill" md="receipt_long" />
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
