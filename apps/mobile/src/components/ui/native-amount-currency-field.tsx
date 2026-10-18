import { useState } from 'react';
import { Button, HStack, Text, TextField, useNativeState } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled,
  keyboardType,
} from '@expo/ui/swift-ui/modifiers';
import { currencySymbol, searchCurrencies } from '@wayfare/domain';

type NativeTextState = ReturnType<typeof useNativeState<string>>;

export function NativeAmountCurrencyField({
  amount,
  onAmountChange,
  currency,
  onCurrencyChange,
  label,
  placeholder,
  isDisabled,
}: {
  amount: NativeTextState;
  onAmountChange: (amount: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  label: string;
  placeholder: string;
  isDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const nativeQuery = useNativeState('');
  const options = query.trim()
    ? searchCurrencies(query).slice(0, 12)
    : [...new Set([currency, 'EUR', 'USD'])].map(
        code => searchCurrencies(code).find(item => item.code === code) ?? { code, name: code },
      );

  function choose(code: string) {
    onCurrencyChange(code);
    nativeQuery.set('');
    setQuery('');
    setOpen(false);
  }

  return (
    <>
      <HStack spacing={8}>
        <TextField
          onTextChange={onAmountChange}
          placeholder={placeholder}
          text={amount}
          modifiers={[accessibilityLabel(label), keyboardType('decimal-pad'), disabled(isDisabled)]}
        />
        <Button
          label={currencySymbol(currency)}
          onPress={() => setOpen(current => !current)}
          modifiers={[
            accessibilityLabel(`Currency ${currency}. Choose currency`),
            buttonStyle('bordered'),
            disabled(isDisabled),
          ]}
        />
      </HStack>
      {open ? (
        <>
          <TextField
            onTextChange={setQuery}
            placeholder="Other currency code or name"
            text={nativeQuery}
            modifiers={[accessibilityLabel('Search currencies'), disabled(isDisabled)]}
          />
          {options.length ? (
            options.map(item => (
              <Button
                key={item.code}
                label={`${currencySymbol(item.code)} · ${item.code} — ${item.name}`}
                onPress={() => choose(item.code)}
                modifiers={[disabled(isDisabled)]}
              />
            ))
          ) : (
            <Text>No matching currency</Text>
          )}
        </>
      ) : null}
    </>
  );
}
