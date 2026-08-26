import * as React from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

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

type TripMapProps = {
  onSelectPlace?: (place: MapPlace) => void;
  onVisiblePlacesChange?: (placeIds: string[]) => void;
  places?: MapPlace[];
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
  onSelectPlace,
  onVisiblePlacesChange,
  places = [],
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
    </MapView>
  );
}
