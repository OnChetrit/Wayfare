export type MapCoordinate = { latitude: number; longitude: number };

type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

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
