import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { wayfareLogo } from '@wayfare/domain';

import { useTheme } from '@/theme/theme-provider';

type WayfareMarkProps = {
  size?: number;
};

export function WayfareMark({ size = 64 }: WayfareMarkProps) {
  const { colors } = useTheme();
  const compassSize = (size * wayfareLogo.compass.size) / wayfareLogo.mark.size;
  const cornerRadius = (size * wayfareLogo.mark.cornerRadius) / wayfareLogo.mark.size;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.accent,
        borderCurve: 'continuous',
        borderRadius: cornerRadius,
        height: size,
        justifyContent: 'center',
        transform: [{ rotate: `${wayfareLogo.mark.rotationDegrees}deg` }],
        width: size,
      }}
    >
      <Svg
        fill="none"
        height={compassSize}
        stroke={colors.accentText}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        style={{ transform: [{ rotate: `${wayfareLogo.compass.rotationDegrees}deg` }] }}
        viewBox={wayfareLogo.compass.viewBox}
        width={compassSize}
      >
        <Path d={wayfareLogo.compass.path} />
        <Circle {...wayfareLogo.compass.circle} />
      </Svg>
    </View>
  );
}
