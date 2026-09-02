import { Pressable, Text, View } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

type Option<T extends string> = { label: string; value: T };

export function Chip<T extends string>({
  option,
  selected,
  onSelect,
  disabled = false,
}: {
  option: Option<T>;
  selected: boolean;
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => onSelect(option.value)}
      style={({ pressed }) => ({
        backgroundColor: selected ? colors.accent : colors.surfaceMuted,
        borderColor: selected ? colors.accent : colors.borderStrong,
        borderCurve: 'continuous',
        borderRadius: radius.pill,
        borderWidth: 1,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        paddingHorizontal: 12,
        paddingVertical: 9,
      })}
    >
      <Text
        selectable
        style={{
          color: selected ? colors.accentText : colors.text,
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(option => (
        <Chip
          key={option.value}
          option={option}
          selected={option.value === value}
          onSelect={onChange}
          disabled={disabled}
        />
      ))}
    </View>
  );
}
