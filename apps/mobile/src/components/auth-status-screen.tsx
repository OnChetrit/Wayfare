import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';

import { WayfareMark } from '@/components/wayfare-mark';

export function AuthStatusScreen({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: '#08211C' }}
    >
      <View style={{ alignItems: 'flex-start', gap: 28 }}>
        <WayfareMark size={52} />
        {children}
      </View>
    </ScrollView>
  );
}
