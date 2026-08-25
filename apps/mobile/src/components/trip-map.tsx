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
  selectedPlace?: MapPlace | null;
};

export function TripMap({ selectedPlace }: TripMapProps) {
  const map = React.useRef<MapView>(null);

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

  return (
    <MapView
      ref={map}
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      initialRegion={initialRegion}
      mapType="standard"
      customMapStyle={mapStyle}
    >
      {selectedPlace ? (
        <Marker
          coordinate={{ latitude: selectedPlace.lat, longitude: selectedPlace.lng }}
          description={selectedPlace.subtitle}
          pinColor={selectedPlace.color ?? '#E8795D'}
          title={selectedPlace.name}
        />
      ) : null}
    </MapView>
  );
}
