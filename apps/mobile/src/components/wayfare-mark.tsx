import { View } from 'react-native';

type WayfareMarkProps = {
  size?: number;
};

export function WayfareMark({ size = 64 }: WayfareMarkProps) {
  const inset = size * 0.18;
  const dotSize = size * 0.18;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: '#E7B96F',
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
          backgroundColor: '#0B2822',
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
          backgroundColor: '#0B2822',
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
          backgroundColor: '#0B2822',
          borderRadius: size,
          height: size * 0.12,
          transform: [{ rotate: '45deg' }],
          width: size * 0.7,
        }}
      />
    </View>
  );
}
