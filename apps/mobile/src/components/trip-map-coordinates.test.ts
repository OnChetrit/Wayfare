import { describe, expect, it } from 'vitest';

import {
  mapCameraKey,
  mapRegionForCoordinates,
  sameMapRegion,
  uniqueMapCoordinates,
} from './trip-map-coordinates';

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

  it('derives the initial camera from the complete itinerary instead of a fixed city', () => {
    const region = mapRegionForCoordinates([
      { latitude: 41.9028, longitude: 12.4964 },
      { latitude: 43.7696, longitude: 11.2558 },
    ]);

    expect(region?.latitude).toBeCloseTo(42.8362);
    expect(region?.longitude).toBeCloseTo(11.8761);
    expect(region?.latitudeDelta).toBeCloseTo(2.52018);
    expect(region?.longitudeDelta).toBeCloseTo(1.67481);
  });

  it('uses the shortest longitude span when a trip crosses the date line', () => {
    const region = mapRegionForCoordinates([
      { latitude: -17.7134, longitude: 178.065 },
      { latitude: -13.759, longitude: -172.1046 },
    ]);

    expect(region?.longitudeDelta).toBeLessThan(20);
    expect(Math.abs(region?.longitude ?? 0)).toBeGreaterThan(170);
  });
});
