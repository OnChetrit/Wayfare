import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';

import { colors, space } from '@/theme/tokens';

export function Screen({
  children,
  contentContainerStyle,
  ...props
}: PropsWithChildren<ScrollViewProps>) {
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
