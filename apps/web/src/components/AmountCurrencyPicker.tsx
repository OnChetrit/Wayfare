'use client';

import { useRef, useState } from 'react';
import { currencySymbol, searchCurrencies } from '@wayfare/domain';
import styles from './AmountCurrencyPicker.module.scss';

export function AmountCurrencyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState('');
  const quick = [...new Set([value, 'EUR', 'USD'])].map(
    code => searchCurrencies(code).find(item => item.code === code) ?? { code, name: code },
  );
  const results = query.trim() ? searchCurrencies(query).slice(0, 12) : [];

  function choose(code: string) {
    onChange(code);
    setQuery('');
    if (details.current) details.current.open = false;
  }

  return (
    <details className={styles.picker} ref={details}>
      <summary aria-label={`Currency: ${value}. Choose currency`} title={value}>
        {currencySymbol(value)}
      </summary>
      <div className={styles.menu}>
        <div className={styles.quick}>
          {quick.map(item => (
            <button key={item.code} type="button" onClick={() => choose(item.code)}>
              {currencySymbol(item.code)} <span>{item.code}</span>
            </button>
          ))}
        </div>
        <input
          aria-label="Search other currencies"
          placeholder="Other currency code or name"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        {results.length > 0 && (
          <div className={styles.results}>
            {results.map(item => (
              <button key={item.code} type="button" onClick={() => choose(item.code)}>
                {item.code} — {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
