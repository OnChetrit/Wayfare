import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { currencySymbol, searchCurrencies } from '@wayfare/domain';
import { Field } from './field';
import { Button } from './button';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

export function CurrencyPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();

  const options = query.trim()
    ? searchCurrencies(query).slice(0, 20)
    : [...new Set([value, 'EUR', 'USD'])].map(
        code => searchCurrencies(code).find(item => item.code === code) ?? { code, name: code },
      );

  return (
    <View style={{ gap: space.sm }}>
      <Button
        accessibilityLabel={`Currency ${value}. Choose currency`}
        accessibilityState={{ expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        style={{ minHeight: 48, minWidth: 58, paddingHorizontal: 10 }}
        tone="secondary"
      >
        {currencySymbol(value)}
      </Button>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{ flex: 1, gap: space.sm, padding: space.lg, backgroundColor: colors.background }}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Currency</Text>
          <Button tone="secondary" onPress={() => setOpen(false)}>
            Done
          </Button>
          <Field label="Search currency code or name" value={query} onChangeText={setQuery} />
          <ScrollView contentInsetAdjustmentBehavior="automatic">
            <View style={{ gap: space.xs }}>
              {options.map(item => (
                <Button
                  accessibilityState={{ selected: item.code === value }}
                  key={item.code}
                  onPress={() => {
                    onChange(item.code);
                    setQuery('');
                    setOpen(false);
                  }}
                  tone={item.code === value ? 'primary' : 'quiet'}
                >
                  {currencySymbol(item.code)} · {item.code} — {item.name}
                </Button>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
