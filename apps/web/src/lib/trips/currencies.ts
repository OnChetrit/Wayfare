import { z } from 'zod';

export const supportedCurrencies = ['EUR', 'USD', 'ILS', 'GBP'] as const;

export type SupportedCurrency = (typeof supportedCurrencies)[number];

export const currencyLabels: Record<SupportedCurrency, string> = {
  EUR: 'Euro',
  USD: 'US Dollar',
  ILS: 'Shekel',
  GBP: 'Pound',
};

export const currencySchema = z.enum(supportedCurrencies);

export function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return supportedCurrencies.includes(value as SupportedCurrency);
}
