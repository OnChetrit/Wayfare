import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

import {
  dateTimeFieldValue,
  dateTimePickerDate,
  type DateTimeFieldMode,
} from './date-time-field-value';
import { Field } from './field';

type DateTimeFieldProps = {
  disabled?: boolean;
  label: string;
  mode: DateTimeFieldMode;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
};

export function DateTimeField({
  disabled = false,
  label,
  mode,
  onChangeText,
  placeholder,
  value,
}: DateTimeFieldProps) {
  const { colors } = useTheme();

  if (process.env.EXPO_OS === 'web') {
    return (
      <Field
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!disabled}
      />
    );
  }

  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
        {label}
      </Text>
      <DateTimePicker
        value={dateTimePickerDate(value, mode)}
        mode={mode}
        display="compact"
        presentation="inline"
        is24Hour={mode === 'time'}
        disabled={disabled}
        onValueChange={(_, selectedDate) => {
          if (!disabled) onChangeText(dateTimeFieldValue(selectedDate, mode));
        }}
      />
    </View>
  );
}
