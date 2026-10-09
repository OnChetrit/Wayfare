import { activeCurrencies, currencyInputSchema } from '@wayfare/domain';
export const supportedCurrencies = activeCurrencies.map(currency => currency.code);
export type SupportedCurrency = string;
export const currencyLabels: Record<string, string> = Object.fromEntries(
  activeCurrencies.map(currency => [currency.code, currency.name]),
);
export const currencySchema = currencyInputSchema;
export function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}
export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return supportedCurrencies.includes(value);
}
