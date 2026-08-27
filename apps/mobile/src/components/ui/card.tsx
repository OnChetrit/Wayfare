import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.card,
          borderWidth: 1,
          gap: space.sm,
          padding: space.md,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
