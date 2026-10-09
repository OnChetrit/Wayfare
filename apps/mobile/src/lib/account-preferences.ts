import { activeCurrencies, type UserPreferences } from '@wayfare/domain';

import { preferredCurrency } from './user-preferences';

export type AccountPreferences = Pick<UserPreferences, 'currency' | 'theme'>;

export const currencyOptions = activeCurrencies.map(currency => ({
  label: `${currency.code} — ${currency.name}`,
  value: currency.code,
}));

function metadataRecord(metadata: unknown) {
  return metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
}

export function displayNameFromMetadata(metadata: unknown, fallback = 'Wayfarer') {
  const values = metadataRecord(metadata);
  for (const key of ['full_name', 'name']) {
    const value = values[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

export function accountPreferencesFromMetadata(
  metadata: unknown,
  fallbackCurrency = 'EUR',
): AccountPreferences {
  const values = metadataRecord(metadata);
  const preferences = metadataRecord(values.preferences);
  const theme = preferences.theme;
  return {
    currency: preferredCurrency(metadata, fallbackCurrency),
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system',
  };
}

export function accountMetadataUpdate(
  existingMetadata: unknown,
  input: { displayName: string; preferences: AccountPreferences },
) {
  const metadata = metadataRecord(existingMetadata);
  const preferences = metadataRecord(metadata.preferences);
  const displayName = input.displayName.trim() || displayNameFromMetadata(metadata);

  return {
    ...metadata,
    full_name: displayName,
    preferences: {
      ...preferences,
      currency: input.preferences.currency,
      theme: input.preferences.theme,
    },
  };
}
