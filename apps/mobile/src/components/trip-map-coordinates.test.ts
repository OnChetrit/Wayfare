import { describe, expect, it } from 'vitest';

import { mapCameraKey, sameMapRegion, uniqueMapCoordinates } from './trip-map-coordinates';

describe('native map coordinates', () => {
  it('drops invalid coordinates and de-duplicates camera input', () => {
    expect(
      uniqueMapCoordinates([
        { latitude: 31.7683, longitude: 35.2137 },
        { latitude: 31.7683, longitude: 35.2137 },
        { latitude: Number.NaN, longitude: 35.2137 },
        { latitude: 91, longitude: 35.2137 },
      ]),
    ).toEqual([{ latitude: 31.7683, longitude: 35.2137 }]);
  });

  it('keeps the camera stable when a native region event does not change it', () => {
    const region = {
      latitude: 31.7683,
      latitudeDelta: 0.1,
      longitude: 35.2137,
      longitudeDelta: 0.1,
    };

    expect(sameMapRegion(region, { ...region })).toBe(true);
    expect(sameMapRegion(region, { ...region, longitudeDelta: 0.2 })).toBe(false);
    expect(mapCameraKey([{ latitude: 31.7683, longitude: 35.2137 }])).toBe('31.7683:35.2137');
  });
});
