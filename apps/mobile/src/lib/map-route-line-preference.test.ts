import { describe, expect, it, vi } from 'vitest';

import {
  MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY,
  readMapRouteLinePreference,
  writeMapRouteLinePreference,
  type MapRouteLinePreferenceStorage,
} from './map-route-line-preference';

describe('native map route-line preference storage', () => {
  it('round-trips the preference through secure storage', async () => {
    const values = new Map<string, string>();
    const storage: MapRouteLinePreferenceStorage = {
      getItemAsync: async key => values.get(key) ?? null,
      setItemAsync: async (key, value) => void values.set(key, value),
    };

    await writeMapRouteLinePreference({ showRouteLines: false }, storage);

    expect(values.get(MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY)).toBe('false');
    await expect(readMapRouteLinePreference(storage)).resolves.toEqual({ showRouteLines: false });
  });

  it('falls back safely when secure storage is unavailable', async () => {
    const storage: MapRouteLinePreferenceStorage = {
      getItemAsync: vi.fn(async () => {
        throw new Error('Secure storage is unavailable');
      }),
      setItemAsync: vi.fn(async () => {
        throw new Error('Secure storage is unavailable');
      }),
    };

    await expect(readMapRouteLinePreference(storage)).resolves.toEqual({ showRouteLines: true });
    await expect(
      writeMapRouteLinePreference({ showRouteLines: false }, storage),
    ).resolves.toBeUndefined();
  });
});
