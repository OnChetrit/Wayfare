import * as React from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import {
  isValidMapCoordinate,
  mapCameraKey,
  sameMapRegion,
  uniqueMapCoordinates,
} from '@/components/trip-map-coordinates';
import { useTheme } from '@/theme/theme-provider';

const initialRegion: Region = {
  latitude: 41.9028,
  longitude: 12.4964,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2a24' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a9b8ae' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2a24' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#415247' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d2a24' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4c6757' }] },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#35463c' }],
  },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1b3328' }] },
];

export type MapPlace = {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  color?: string;
};

export type MapRoute = {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  color?: string;
  dashed?: boolean;
};

type TripMapProps = {
  fitToPlaces?: boolean;
  onSelectPlace?: (place: MapPlace) => void;
  onVisiblePlacesChange?: (placeIds: string[]) => void;
  places?: MapPlace[];
  routes?: MapRoute[];
  showRouteLines?: boolean;
  selectedPlace?: MapPlace | null;
};

function isPlaceVisible(place: MapPlace, region: Region) {
  const latitudeDelta = region.latitudeDelta / 2;
  const longitudeDelta = region.longitudeDelta / 2;
  const minimumLatitude = region.latitude - latitudeDelta;
  const maximumLatitude = region.latitude + latitudeDelta;
  const minimumLongitude = region.longitude - longitudeDelta;
  const maximumLongitude = region.longitude + longitudeDelta;
  const isVisibleLongitude =
    minimumLongitude < -180
      ? place.lng >= minimumLongitude + 360 || place.lng <= maximumLongitude
      : maximumLongitude > 180
        ? place.lng >= minimumLongitude || place.lng <= maximumLongitude - 360
        : place.lng >= minimumLongitude && place.lng <= maximumLongitude;

  return place.lat >= minimumLatitude && place.lat <= maximumLatitude && isVisibleLongitude;
}

export function TripMap({
  fitToPlaces = false,
  onSelectPlace,
  onVisiblePlacesChange,
  places = [],
  routes = [],
  showRouteLines = true,
  selectedPlace,
}: TripMapProps) {
  const { colors, theme } = useTheme();
  const map = React.useRef<MapView>(null);
  const lastFittedCameraKey = React.useRef<string | null>(null);
  const [region, setRegion] = React.useState(initialRegion);
  const [mapReady, setMapReady] = React.useState(false);
  const mapPlaces = React.useMemo(() => {
    const uniquePlaces = new Map<string, MapPlace>();
    for (const place of [...(selectedPlace ? [selectedPlace] : []), ...places]) {
      if (
        !uniquePlaces.has(place.id) &&
        isValidMapCoordinate({ latitude: place.lat, longitude: place.lng })
      ) {
        uniquePlaces.set(place.id, place);
      }
    }
    return Array.from(uniquePlaces.values());
  }, [places, selectedPlace]);

  React.useEffect(() => {
    if (
      !mapReady ||
      !selectedPlace ||
      !isValidMapCoordinate({ latitude: selectedPlace.lat, longitude: selectedPlace.lng })
    )
      return;

    map.current?.animateToRegion(
      {
        latitude: selectedPlace.lat,
        longitude: selectedPlace.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      360,
    );
  }, [mapReady, selectedPlace]);

  const visibleRoutes = React.useMemo(
    () =>
      showRouteLines
        ? routes
            .map(route => ({
              ...route,
              coordinates: route.coordinates.filter(isValidMapCoordinate),
            }))
            .filter(route => route.coordinates.length >= 2)
        : [],
    [routes, showRouteLines],
  );
  const cameraCoordinates = React.useMemo(
    () =>
      uniqueMapCoordinates([
        ...places.map(place => ({ latitude: place.lat, longitude: place.lng })),
        ...visibleRoutes.flatMap(route => route.coordinates),
      ]),
    [places, visibleRoutes],
  );
  const nextCameraKey = React.useMemo(() => mapCameraKey(cameraCoordinates), [cameraCoordinates]);

  React.useEffect(() => {
    if (!fitToPlaces || !mapReady || !cameraCoordinates.length) return;
    if (lastFittedCameraKey.current === nextCameraKey) return;

    lastFittedCameraKey.current = nextCameraKey;
    if (cameraCoordinates.length === 1) {
      map.current?.animateToRegion(
        {
          ...cameraCoordinates[0],
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
        },
        360,
      );
      return;
    }
    map.current?.fitToCoordinates(cameraCoordinates, {
      animated: true,
      edgePadding: { bottom: 56, left: 40, right: 40, top: 56 },
    });
  }, [cameraCoordinates, fitToPlaces, mapReady, nextCameraKey]);

  React.useEffect(() => {
    onVisiblePlacesChange?.(
      mapPlaces.filter(place => isPlaceVisible(place, region)).map(place => place.id),
    );
  }, [mapPlaces, onVisiblePlacesChange, region]);

  return (
    <MapView
      ref={map}
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      initialRegion={initialRegion}
      mapType="standard"
      onMapReady={() => setMapReady(true)}
      onRegionChangeComplete={nextRegion =>
        setRegion(currentRegion =>
          sameMapRegion(currentRegion, nextRegion) ? currentRegion : nextRegion,
        )
      }
      customMapStyle={theme === 'dark' ? darkMapStyle : undefined}
    >
      {mapPlaces.map(place => (
        <Marker
          coordinate={{ latitude: place.lat, longitude: place.lng }}
          description={place.subtitle}
          key={place.id}
          onPress={() => onSelectPlace?.(place)}
          pinColor={place.color ?? colors.danger}
          title={place.name}
        />
      ))}
      {visibleRoutes.map(route => (
        <Polyline
          coordinates={route.coordinates}
          key={route.id}
          lineDashPattern={route.dashed ? [8, 8] : undefined}
          strokeColor={route.color ?? colors.accent}
          strokeWidth={route.dashed ? 2 : 4}
        />
      ))}
    </MapView>
  );
}
