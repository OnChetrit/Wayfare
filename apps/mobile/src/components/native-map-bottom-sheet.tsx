import { BottomSheet } from '@expo/ui';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

type NativeMapBottomSheetProps = {
  background: React.ReactElement;
  children: React.ReactElement;
};

// Expo UI supplies the platform-native implementation outside iOS as well.
// iOS has a dedicated SwiftUI version with the Find My-style closed detent.
export function NativeMapBottomSheet({ background, children }: NativeMapBottomSheetProps) {
  const [isPresented, setIsPresented] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setIsPresented(true);
      return () => setIsPresented(false);
    }, []),
  );

  return (
    <View style={{ flex: 1 }}>
      {background}
      <BottomSheet
        contentPadding={0}
        isPresented={isPresented}
        onDismiss={() => setIsPresented(true)}
        snapPoints={['half', 'full']}
      >
        {children}
      </BottomSheet>
    </View>
  );
}
