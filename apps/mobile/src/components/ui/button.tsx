import * as Haptics from 'expo-haptics';
import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '@/theme/tokens';

type ButtonProps = PropsWithChildren<
  Omit<PressableProps, 'style'> & {
    tone?: 'primary' | 'secondary' | 'danger' | 'quiet';
    loading?: boolean;
    style?: ViewStyle;
  }
>;

const tones = {
  primary: { backgroundColor: colors.accent, borderColor: colors.accent, text: colors.accentText },
  secondary: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
    text: colors.text,
  },
  danger: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    text: colors.danger,
  },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent', text: colors.textMuted },
} as const;

export function Button({
  children,
  disabled,
  loading,
  onPress,
  style,
  tone = 'primary',
  ...props
}: ButtonProps) {
  const palette = tones[tone];
  const isDisabled = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={event => {
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          borderCurve: 'continuous',
          borderRadius: radius.control,
          borderWidth: tone === 'quiet' ? 0 : 1,
          flexDirection: 'row',
          gap: 8,
          justifyContent: 'center',
          minHeight: 44,
          opacity: isDisabled ? 0.45 : pressed ? 0.78 : 1,
          paddingHorizontal: 14,
        },
        style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={palette.text} /> : null}
      {typeof children === 'string' ? (
        <Text selectable style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function IconButton({ label, children, ...props }: ButtonProps & { label: string }) {
  return (
    <Button
      accessibilityLabel={label}
      style={{ minWidth: 44, paddingHorizontal: 10 }}
      tone="secondary"
      {...props}
    >
      {children}
    </Button>
  );
}
