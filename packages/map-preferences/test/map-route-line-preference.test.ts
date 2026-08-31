import { describe, expect, it } from 'vitest';

import {
  defaultMapRouteLinePreference,
  parseMapRouteLinePreference,
  serializeMapRouteLinePreference,
} from '../src';

describe('map route-line preferences', () => {
  it('defaults to visible route lines for missing or malformed values', () => {
    expect(parseMapRouteLinePreference(null)).toEqual(defaultMapRouteLinePreference);
    expect(parseMapRouteLinePreference('yes')).toEqual(defaultMapRouteLinePreference);
    expect(parseMapRouteLinePreference('{"showRouteLines":false}')).toEqual(
      defaultMapRouteLinePreference,
    );
  });

  it('round-trips the route-line setting', () => {
    const preference = { showRouteLines: false };

    expect(parseMapRouteLinePreference(serializeMapRouteLinePreference(preference))).toEqual(
      preference,
    );
  });
});
