import * as React from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

const initialRegion: Region = {
  latitude: 41.9028,
  longitude: 12.4964,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#102A21' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#B7CABC' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#102A21' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#274B3E' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#102A21' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#6D9B82' }] },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#23483A' }],
  },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#153027' }] },
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
  selectedPlace,
}: TripMapProps) {
  const map = React.useRef<MapView>(null);
  const [region, setRegion] = React.useState(initialRegion);
  const mapPlaces = React.useMemo(() => {
    const uniquePlaces = new Map<string, MapPlace>();
    for (const place of [...(selectedPlace ? [selectedPlace] : []), ...places]) {
      if (!uniquePlaces.has(place.id)) uniquePlaces.set(place.id, place);
    }
    return Array.from(uniquePlaces.values());
  }, [places, selectedPlace]);

  React.useEffect(() => {
    if (!selectedPlace) return;

    map.current?.animateToRegion(
      {
        latitude: selectedPlace.lat,
        longitude: selectedPlace.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      360,
    );
  }, [selectedPlace]);

  const routeCoordinates = React.useMemo(
    () => routes.flatMap(route => route.coordinates),
    [routes],
  );

  React.useEffect(() => {
    if (!fitToPlaces || !mapPlaces.length) return;
    const coordinates = [
      ...mapPlaces.map(place => ({ latitude: place.lat, longitude: place.lng })),
      ...routeCoordinates,
    ];
    if (coordinates.length === 1) {
      map.current?.animateToRegion(
        {
          ...coordinates[0],
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
        },
        360,
      );
      return;
    }
    map.current?.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { bottom: 56, left: 40, right: 40, top: 56 },
    });
  }, [fitToPlaces, mapPlaces, routeCoordinates]);

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
      onRegionChangeComplete={setRegion}
      customMapStyle={mapStyle}
    >
      {mapPlaces.map(place => (
        <Marker
          coordinate={{ latitude: place.lat, longitude: place.lng }}
          description={place.subtitle}
          key={place.id}
          onPress={() => onSelectPlace?.(place)}
          pinColor={place.color ?? '#E8795D'}
          title={place.name}
        />
      ))}
      {routes.map(route =>
        route.coordinates.length >= 2 ? (
          <Polyline
            coordinates={route.coordinates}
            key={route.id}
            lineDashPattern={route.dashed ? [8, 8] : undefined}
            strokeColor={route.color ?? '#E7B96F'}
            strokeWidth={route.dashed ? 2 : 4}
          />
        ) : null,
      )}
    </MapView>
  );
}
