import { describe, expect, it, vi } from 'vitest';
import { MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY } from '@wayfare/map-preferences';

import {
  readMapRouteLinePreference,
  writeMapRouteLinePreference,
} from './map-route-line-preference';

describe('web map route-line preference storage', () => {
  it('reads and writes the local route-line preference', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };

    writeMapRouteLinePreference({ showRouteLines: false }, storage);

    expect(values.get(MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY)).toBe('false');
    expect(readMapRouteLinePreference(storage)).toEqual({ showRouteLines: false });
  });

  it('falls back to visible route lines when browser storage fails', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('Storage is unavailable');
      }),
      setItem: vi.fn(() => {
        throw new Error('Storage is unavailable');
      }),
    };

    expect(readMapRouteLinePreference(storage)).toEqual({ showRouteLines: true });
    expect(() => writeMapRouteLinePreference({ showRouteLines: false }, storage)).not.toThrow();
  });
});
