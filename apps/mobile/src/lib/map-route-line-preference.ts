export type MapRouteLinePreference = {
  showRouteLines: boolean;
};

export const MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY = 'wayfare.map.show-route-lines';

export const defaultMapRouteLinePreference: MapRouteLinePreference = {
  showRouteLines: true,
};

function parseMapRouteLinePreference(value: string | null): MapRouteLinePreference {
  if (value === 'true') return { showRouteLines: true };
  if (value === 'false') return { showRouteLines: false };
  return defaultMapRouteLinePreference;
}

function serializeMapRouteLinePreference(preference: MapRouteLinePreference) {
  return String(preference.showRouteLines);
}

export type MapRouteLinePreferenceStorage = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

export async function readMapRouteLinePreference(
  storage: MapRouteLinePreferenceStorage,
): Promise<MapRouteLinePreference> {
  try {
    return parseMapRouteLinePreference(
      await storage.getItemAsync(MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY),
    );
  } catch {
    return defaultMapRouteLinePreference;
  }
}

export async function writeMapRouteLinePreference(
  preference: MapRouteLinePreference,
  storage: MapRouteLinePreferenceStorage,
) {
  try {
    await storage.setItemAsync(
      MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY,
      serializeMapRouteLinePreference(preference),
    );
  } catch {
    // A storage failure leaves the optimistic in-memory preference intact.
  }
}
