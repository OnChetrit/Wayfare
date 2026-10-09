export type MapCoordinate = { latitude: number; longitude: number };

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

const MINIMUM_REGION_DELTA = 0.045;

export function isValidMapCoordinate(coordinate: MapCoordinate) {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

export function sameMapRegion(left: MapRegion, right: MapRegion) {
  return (
    left.latitude === right.latitude &&
    left.longitude === right.longitude &&
    left.latitudeDelta === right.latitudeDelta &&
    left.longitudeDelta === right.longitudeDelta
  );
}

export function uniqueMapCoordinates(coordinates: MapCoordinate[]) {
  const coordinatesByPosition = new Map<string, MapCoordinate>();
  for (const coordinate of coordinates) {
    if (!isValidMapCoordinate(coordinate)) continue;
    coordinatesByPosition.set(`${coordinate.latitude}:${coordinate.longitude}`, coordinate);
  }
  return Array.from(coordinatesByPosition.values());
}

export function mapCameraKey(coordinates: MapCoordinate[]) {
  return coordinates.map(coordinate => `${coordinate.latitude}:${coordinate.longitude}`).join('|');
}

/** Builds an initial camera that contains the supplied itinerary coordinates. */
export function mapRegionForCoordinates(coordinates: MapCoordinate[]): MapRegion | null {
  const validCoordinates = uniqueMapCoordinates(coordinates);
  if (!validCoordinates.length) return null;
  if (validCoordinates.length === 1) {
    return {
      ...validCoordinates[0],
      latitudeDelta: MINIMUM_REGION_DELTA,
      longitudeDelta: MINIMUM_REGION_DELTA,
    };
  }

  const latitudes = validCoordinates.map(coordinate => coordinate.latitude);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const longitudes = validCoordinates
    .map(coordinate => (coordinate.longitude + 360) % 360)
    .sort((left, right) => left - right);
  let largestGap = -1;
  let longitudeStart = longitudes[0];

  longitudes.forEach((longitude, index) => {
    const nextLongitude =
      longitudes[(index + 1) % longitudes.length] + (index === longitudes.length - 1 ? 360 : 0);
    const gap = nextLongitude - longitude;
    if (gap > largestGap) {
      largestGap = gap;
      longitudeStart = nextLongitude % 360;
    }
  });

  const longitudeSpan = 360 - largestGap;
  const centeredLongitude = ((longitudeStart + longitudeSpan / 2 + 540) % 360) - 180;

  return {
    latitude: (minimumLatitude + maximumLatitude) / 2,
    longitude: centeredLongitude,
    latitudeDelta: Math.min(
      170,
      Math.max(MINIMUM_REGION_DELTA, (maximumLatitude - minimumLatitude) * 1.35),
    ),
    longitudeDelta: Math.min(360, Math.max(MINIMUM_REGION_DELTA, longitudeSpan * 1.35)),
  };
}
