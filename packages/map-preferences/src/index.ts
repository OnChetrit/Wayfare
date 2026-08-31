/**
 * Per-device presentation state. This deliberately does not belong to the
 * collaborative trip domain or any API payload.
 */
export type MapRouteLinePreference = {
  showRouteLines: boolean;
};

export const MAP_ROUTE_LINE_PREFERENCE_STORAGE_KEY = 'wayfare.map.show-route-lines';

export const defaultMapRouteLinePreference: MapRouteLinePreference = {
  showRouteLines: true,
};

export function parseMapRouteLinePreference(value: string | null): MapRouteLinePreference {
  if (value === 'true') return { showRouteLines: true };
  if (value === 'false') return { showRouteLines: false };
  return defaultMapRouteLinePreference;
}

export function serializeMapRouteLinePreference(preference: MapRouteLinePreference) {
  return String(preference.showRouteLines);
}
