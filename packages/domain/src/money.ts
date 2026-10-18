import { z } from 'zod';
import catalog from './currency-catalog.json';

export const currencyCatalogVersion = catalog.version;
export const currencyCatalog = catalog.currencies;
export const activeCurrencies = currencyCatalog.filter(currency => currency.active);
export const currencyInputSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    code => activeCurrencies.some(currency => currency.code === code),
    'Choose a currency from the ISO 4217 catalog.',
  );

export function currencyPrecision(code: string) {
  const currency = currencyCatalog.find(entry => entry.code === code);
  if (currency) return currency.digits;
  // Historic records remain readable even after their currency is withdrawn.
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** Decimal input to integer minor units, without rounding or binary floating point arithmetic. */
export function moneyMinorUnits(value: string | number, currency: string): bigint {
  const input = String(value).trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(input);
  if (!match) throw new Error('Enter a non-negative decimal amount.');
  const precision = currencyPrecision(currency);
  const fraction = match[2] ?? '';
  if (fraction.length > precision && /[1-9]/.test(fraction.slice(precision))) {
    throw new Error(`${currency} allows ${precision} decimal places. The amount was not rounded.`);
  }
  const units =
    BigInt(match[1]) * 10n ** BigInt(precision) +
    BigInt(fraction.slice(0, precision).padEnd(precision, '0') || '0');
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large.');
  return units;
}

export function moneyFromMinorUnits(units: bigint, currency: string): string {
  const precision = currencyPrecision(currency);
  if (!precision) return String(units);
  const digits = String(units).padStart(precision + 1, '0');
  return `${digits.slice(0, -precision)}.${digits.slice(-precision)}`;
}

export function splitMoneyEqually(value: string | number, currency: string, count: number) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Select at least one item.');
  const total = moneyMinorUnits(value, currency);
  return Array.from({ length: count }, (_, index) =>
    moneyFromMinorUnits(
      total / BigInt(count) + (BigInt(index) < total % BigInt(count) ? 1n : 0n),
      currency,
    ),
  );
}

export function formatMoney(amount: number | string, currency: string) {
  const precision = currencyPrecision(currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(Number(amount));
}

export function currencySymbol(code: string) {
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find(part => part.type === 'currency')?.value ?? code
    );
  } catch {
    return code;
  }
}

export function searchCurrencies(query: string, preferred: readonly string[] = []) {
  const needle = query.trim().toLowerCase();
  return activeCurrencies
    .filter(entry => `${entry.code} ${entry.name}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      const rank = (code: string) =>
        preferred.includes(code) ? preferred.indexOf(code) : preferred.length;
      return rank(a.code) - rank(b.code) || a.code.localeCompare(b.code);
    });
}
