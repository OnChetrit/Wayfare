import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

export function Screen({
  children,
  contentContainerStyle,
  ...props
}: PropsWithChildren<ScrollViewProps>) {
  const { colors } = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        { flexGrow: 1, gap: space.md, padding: space.md, paddingBottom: space.xl },
        contentContainerStyle,
      ]}
      style={{ backgroundColor: colors.background }}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function Row({ children }: PropsWithChildren) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {children}
    </View>
  );
}
