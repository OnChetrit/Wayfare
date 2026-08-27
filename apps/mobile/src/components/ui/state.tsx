import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/theme/theme-provider';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', minHeight: 220 }}
    >
      <ActivityIndicator color={colors.accent} />
      <Text selectable style={{ color: colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: 10,
        justifyContent: 'center',
        minHeight: 220,
        padding: 24,
      }}
    >
      <Text
        selectable
        style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}
      >
        {title}
      </Text>
      <Text selectable style={{ color: colors.textMuted, lineHeight: 21, textAlign: 'center' }}>
        {detail}
      </Text>
      {action}
    </View>
  );
}

export function ErrorState({
  title = 'Couldn’t load this trip',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: 12,
        justifyContent: 'center',
        minHeight: 220,
        padding: 24,
      }}
    >
      <Text
        selectable
        style={{ color: colors.danger, fontSize: 16, fontWeight: '700', textAlign: 'center' }}
      >
        {title}
      </Text>
      <Text selectable style={{ color: colors.textMuted, lineHeight: 21, textAlign: 'center' }}>
        {message}
      </Text>
      {onRetry ? <Button onPress={onRetry}>Try again</Button> : null}
    </View>
  );
}

export function OfflineNotice({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        borderWidth: 1,
        padding: 11,
      }}
    >
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
        You’re offline. Saved trip data stays available, but edits will be enabled when you
        reconnect.
      </Text>
    </View>
  );
}
