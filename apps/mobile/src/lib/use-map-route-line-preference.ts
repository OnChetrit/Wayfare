import * as React from 'react';
import * as SecureStore from 'expo-secure-store';

import {
  defaultMapRouteLinePreference,
  readMapRouteLinePreference,
  writeMapRouteLinePreference,
  type MapRouteLinePreference,
  type MapRouteLinePreferenceStorage,
} from './map-route-line-preference';

const secureStore: MapRouteLinePreferenceStorage = {
  getItemAsync: key => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
};

export function useMapRouteLinePreference() {
  const [preference, setPreference] = React.useState(defaultMapRouteLinePreference);

  React.useEffect(() => {
    let isMounted = true;

    void readMapRouteLinePreference(secureStore).then(storedPreference => {
      if (isMounted) setPreference(storedPreference);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const setShowRouteLines = React.useCallback((showRouteLines: boolean) => {
    const nextPreference: MapRouteLinePreference = { showRouteLines };
    setPreference(nextPreference);
    void writeMapRouteLinePreference(nextPreference, secureStore);
  }, []);

  return { showRouteLines: preference.showRouteLines, setShowRouteLines };
}
