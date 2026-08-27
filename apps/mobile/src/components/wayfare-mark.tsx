import { View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

type WayfareMarkProps = {
  size?: number;
};

export function WayfareMark({ size = 64 }: WayfareMarkProps) {
  const { colors } = useTheme();
  const inset = size * 0.18;
  const dotSize = size * 0.18;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.accent,
        borderCurve: 'continuous',
        borderRadius: size * 0.32,
        height: size,
        justifyContent: 'center',
        overflow: 'hidden',
        width: size,
      }}
    >
      <View
        style={{
          backgroundColor: colors.accentText,
          borderRadius: dotSize / 2,
          height: dotSize,
          left: inset,
          position: 'absolute',
          top: inset,
          width: dotSize,
        }}
      />
      <View
        style={{
          backgroundColor: colors.accentText,
          borderRadius: dotSize / 2,
          bottom: inset,
          height: dotSize,
          position: 'absolute',
          right: inset,
          width: dotSize,
        }}
      />
      <View
        style={{
          backgroundColor: colors.accentText,
          borderRadius: size,
          height: size * 0.12,
          transform: [{ rotate: '45deg' }],
          width: size * 0.7,
        }}
      />
    </View>
  );
}
