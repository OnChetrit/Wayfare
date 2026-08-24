import { BottomSheet, Group, Host, RNHostView, VStack } from '@expo/ui/swift-ui';
import {
  disabled,
  interactiveDismissDisabled,
  opacity,
  presentationBackground,
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  type PresentationDetent,
} from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

type NativeMapBottomSheetProps = {
  background: React.ReactElement;
  children: React.ReactNode;
};

// Keep a native, visible grabber when the list is closed. SwiftUI owns the
// gesture and sheet lifecycle rather than a JS-driven pan gesture.
const collapsedDetent: PresentationDetent = { height: 64 };
const detents: PresentationDetent[] = [collapsedDetent, 'medium', 'large'];

function isCollapsedDetent(detent: PresentationDetent) {
  return typeof detent !== 'string' && 'height' in detent && detent.height === 64;
}

export function NativeMapBottomSheet({ background, children }: NativeMapBottomSheetProps) {
  const [isPresented, setIsPresented] = React.useState(false);
  const [selectedDetent, setSelectedDetent] = React.useState<PresentationDetent>('medium');
  const [isListCollapsed, setIsListCollapsed] = React.useState(false);

  // Tab routes remain mounted. Resetting here ensures returning from the other
  // tab never restores a previously expanded sheet.
  useFocusEffect(() => {
      setSelectedDetent('medium');
      setIsListCollapsed(false);
      setIsPresented(true);

      return () => {
        setIsPresented(false);
        setSelectedDetent('medium');
        setIsListCollapsed(false);
      };
    },
  );

  return (
    <Host matchContents colorScheme="dark" seedColor="#9FE2C2" style={{ flex: 1 }} useViewportSizeMeasurement>
      <VStack>
        <BottomSheet
          anchor={
            <RNHostView>
              <View style={{ flex: 1 }}>{background}</View>
            </RNHostView>
          }
          isPresented={isPresented}
          onIsPresentedChange={setIsPresented}
        >
          <Group
            modifiers={[
              presentationDetents(detents, {
                selection: selectedDetent,
                onSelectionChange: detent => {
                  setSelectedDetent(detent);
                  setIsListCollapsed(isCollapsedDetent(detent));
                },
              }),
              presentationDragIndicator('visible'),
              presentationBackground('#102A21'),
              presentationBackgroundInteraction({
                type: 'enabledUpThrough',
                detent: 'medium',
              }),
              interactiveDismissDisabled(),
            ]}
          >
            <Group modifiers={[opacity(isListCollapsed ? 0 : 1), disabled(isListCollapsed)]}>
              {children}
            </Group>
          </Group>
        </BottomSheet>
      </VStack>
    </Host>
  );
}
