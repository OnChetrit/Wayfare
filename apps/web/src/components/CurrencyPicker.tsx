'use client';
import { useId, useState } from 'react';
import { searchCurrencies } from '@wayfare/domain';
import styles from './CurrencyPicker.module.scss';

export function CurrencyPicker({
  value,
  onChange,
  preferred = [],
}: {
  value: string;
  onChange: (value: string) => void;
  preferred?: string[];
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  return (
    <span className={styles.picker}>
      <input
        className={styles.search}
        aria-label="Search currencies by code or name"
        placeholder="Search currencies"
        value={query}
        onChange={event => setQuery(event.target.value)}
      />
      <select
        className={styles.select}
        id={id}
        aria-label="Currency"
        value={value}
        onChange={event => {
          onChange(event.target.value);
        }}
      >
        {!searchCurrencies(query).some(currency => currency.code === value) && (
          <option value={value}>{value}</option>
        )}
        {searchCurrencies(query, [value, ...preferred]).map(currency => (
          <option key={currency.code} value={currency.code}>
            {currency.code} — {currency.name}
          </option>
        ))}
      </select>
    </span>
  );
}
