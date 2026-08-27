import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';

import { WayfareMark } from '@/components/wayfare-mark';
import { useTheme } from '@/theme/theme-provider';

export function AuthStatusScreen({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ alignItems: 'flex-start', gap: 28 }}>
        <WayfareMark size={52} />
        {children}
      </View>
    </ScrollView>
  );
}
