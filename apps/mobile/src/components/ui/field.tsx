import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius } from '@/theme/tokens';

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor="#7F9A8F"
        style={[
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.borderStrong,
            borderCurve: 'continuous',
            borderRadius: radius.control,
            borderWidth: 1,
            color: colors.text,
            fontSize: 16,
            minHeight: props.multiline ? 96 : 48,
            paddingHorizontal: 13,
            paddingVertical: props.multiline ? 12 : 0,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}
