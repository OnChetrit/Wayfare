'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  defaultMapRouteLinePreference,
  MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY,
  parseMapRouteLinePreference,
  serializeMapRouteLinePreference,
  type MapRouteLinePreference,
} from '@wayfare/map-preferences';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): BrowserStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readMapRouteLinePreference(
  storage: BrowserStorage | null = browserStorage(),
): MapRouteLinePreference {
  try {
    return storage
      ? parseMapRouteLinePreference(storage.getItem(MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY))
      : defaultMapRouteLinePreference;
  } catch {
    return defaultMapRouteLinePreference;
  }
}

export function writeMapRouteLinePreference(
  preference: MapRouteLinePreference,
  storage: BrowserStorage | null = browserStorage(),
) {
  try {
    storage?.setItem(
      MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY,
      serializeMapRouteLinePreference(preference),
    );
  } catch {
    // A blocked or full browser storage area should not prevent map use.
  }
}

export function useMapRouteLinePreference() {
  const [preference, setPreference] = useState(defaultMapRouteLinePreference);

  useEffect(() => {
    const timeout = window.setTimeout(() => setPreference(readMapRouteLinePreference()), 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const setShowRouteLines = useCallback((showRouteLines: boolean) => {
    const nextPreference = { showRouteLines };
    setPreference(nextPreference);
    writeMapRouteLinePreference(nextPreference);
  }, []);

  return { showRouteLines: preference.showRouteLines, setShowRouteLines };
}
