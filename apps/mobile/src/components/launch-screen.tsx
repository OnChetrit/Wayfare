import type { LayoutChangeEvent } from 'react-native';
import * as React from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { WayfareMark } from '@/components/wayfare-mark';
import { useTheme } from '@/theme/theme-provider';

type LaunchScreenProps = {
  onLayout: (event: LayoutChangeEvent) => void;
};

export function LaunchScreen({ onLayout }: LaunchScreenProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.88);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 650 }), withTiming(1, { duration: 650 })),
      -1,
      false,
    );

    return () => cancelAnimation(scale);
  }, [scale]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={{
        alignItems: 'center',
        backgroundColor: colors.background,
        flex: 1,
        justifyContent: 'center',
      }}
    >
      <Animated.View entering={FadeIn.duration(320)} style={markStyle}>
        <WayfareMark size={82} />
      </Animated.View>
      <Animated.View
        entering={FadeInUp.duration(360).delay(120)}
        style={{ alignItems: 'center', gap: 6, marginTop: 22 }}
      >
        <Text
          selectable
          style={{ color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.8 }}
        >
          Wayfare
        </Text>
        <Text selectable style={{ color: colors.textMuted, fontSize: 14, letterSpacing: 0.8 }}>
          MAKE SPACE FOR THE GOOD PARTS
        </Text>
      </Animated.View>
    </View>
  );
}
