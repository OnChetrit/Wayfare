import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { searchCurrencies } from '@wayfare/domain';
import { Field } from './field';
import { Button } from './button';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

export function CurrencyPicker({
  value,
  onChange,
  preferred = [],
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  preferred?: string[];
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();

  return (
    <View style={{ gap: space.sm }}>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
        Currency
      </Text>
      <Button
        accessibilityState={{ expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        tone="secondary"
      >
        {value} · Change currency
      </Button>
      {open && (
        <View style={{ gap: space.sm }}>
          <Field label="Search currency code or name" value={query} onChangeText={setQuery} />
          <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ maxHeight: 220 }}>
            <View style={{ gap: space.xs }}>
              {searchCurrencies(query, [value, ...preferred]).map(item => (
                <Button
                  accessibilityState={{ selected: item.code === value }}
                  key={item.code}
                  onPress={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  tone={item.code === value ? 'primary' : 'quiet'}
                >
                  {item.code} — {item.name}
                </Button>
              ))}
            </View>
          </ScrollView>
          <Text selectable style={{ color: colors.textMuted }}>
            Amounts stay in their original currency.
          </Text>
        </View>
      )}
    </View>
  );
}
