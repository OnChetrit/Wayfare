import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';

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

export function TripMap() {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      initialRegion={initialRegion}
      mapType="standard"
      customMapStyle={mapStyle}
    />
  );
}
