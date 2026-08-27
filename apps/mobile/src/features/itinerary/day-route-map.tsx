import type { TripEditorTrip, TripFlight } from '@wayfare/domain';
import * as React from 'react';
import { Text, View } from 'react-native';

import { searchGooglePlaces } from '@/api/trips';
import { TripMap, type MapPlace, type MapRoute } from '@/components/trip-map';
import { Card } from '@/components/ui/card';
import { colors } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

type Airport = {
  id: string;
  name: string;
  query: string;
};

function airportForFlight(flight: TripFlight, phase: 'arrival' | 'departure'): Airport | null {
  const isDeparture = phase === 'departure';
  const airportName = isDeparture ? flight.departureAirportName : flight.arrivalAirportName;
  const iata = isDeparture ? flight.departureAirportIata : flight.arrivalAirportIata;
  const icao = isDeparture ? flight.departureAirportIcao : flight.arrivalAirportIcao;
  const label = airportName ?? iata ?? icao;
  if (!label) return null;
  const code = iata ?? icao;
  return {
    id: `${flight.id}:${phase}`,
    name: label,
    query: `${airportName ?? label}${code ? ` (${code})` : ''} airport`,
  };
}

function uniquePlaces(places: MapPlace[]) {
  return Array.from(new Map(places.map(place => [place.id, place])).values());
}

export function DayRouteMap({ date, trip }: { date: string; trip: TripEditorTrip }) {
  useTheme();
  const [airports, setAirports] = React.useState<Record<string, MapPlace>>({});
  const flights = React.useMemo(
    () =>
      trip.flights.filter(flight => flight.departureDate === date || flight.arrivalDate === date),
    [date, trip.flights],
  );
  const airportRequests = React.useMemo(
    () =>
      flights.flatMap(flight =>
        [airportForFlight(flight, 'departure'), airportForFlight(flight, 'arrival')].filter(
          (airport): airport is Airport => Boolean(airport),
        ),
      ),
    [flights],
  );

  React.useEffect(() => {
    const missingAirports = airportRequests.filter(airport => !airports[airport.id]);
    if (!missingAirports.length) return;
    const controller = new AbortController();

    void Promise.all(
      missingAirports.map(async airport => {
        const result = await searchGooglePlaces(airport.query, undefined, controller.signal).catch(
          () => [],
        );
        const place = result[0];
        return place
          ? {
              id: airport.id,
              name: airport.name,
              subtitle: 'Airport',
              lat: place.lat,
              lng: place.lng,
              color: '#4d7fa3',
            }
          : null;
      }),
    ).then(resolved => {
      if (controller.signal.aborted) return;
      const mapped = resolved.filter(airport => airport !== null);
      if (!mapped.length) return;
      const resolvedAirports: Record<string, MapPlace> = {};
      for (const airport of mapped) resolvedAirports[airport.id] = airport;
      setAirports(current => ({
        ...current,
        ...resolvedAirports,
      }));
    });

    return () => controller.abort();
  }, [airportRequests, airports]);

  const placesById = React.useMemo(
    () => new Map(trip.places.map(place => [place.id, place])),
    [trip.places],
  );
  const locationPlaces = trip.locationSegments
    .filter(segment => segment.startDate <= date && date < segment.endDate)
    .flatMap(segment =>
      segment.latitude != null && segment.longitude != null
        ? [
            {
              id: `location:${segment.id}`,
              name: segment.locationName,
              subtitle: 'Trip location',
              lat: segment.latitude,
              lng: segment.longitude,
              color: '#86D8A7',
            },
          ]
        : [],
    );
  const stayPlaces = trip.stays
    .filter(stay => stay.checkInDate <= date && stay.checkOutDate >= date)
    .flatMap(stay => {
      const place = stay.savedPlaceId ? placesById.get(stay.savedPlaceId) : undefined;
      return place
        ? [
            {
              id: `stay:${stay.id}`,
              name: stay.name,
              subtitle: 'Stay',
              lat: place.lat,
              lng: place.lng,
              color: '#9D91E8',
            },
          ]
        : [];
    });
  const scheduledPlaces = trip.schedule
    .filter(item => item.date === date)
    .sort(
      (a, b) => a.startTime.localeCompare(b.startTime) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    )
    .flatMap(item => {
      const place = item.savedPlaceId ? placesById.get(item.savedPlaceId) : undefined;
      return place
        ? [
            {
              id: `schedule:${item.id}`,
              name: place.name,
              subtitle: `${item.startTime} · Planned stop`,
              lat: place.lat,
              lng: place.lng,
              color: place.color,
            },
          ]
        : [];
    });
  const flightPlaces = airportRequests.flatMap(airport =>
    airports[airport.id] ? [airports[airport.id]] : [],
  );
  const mapPlaces = uniquePlaces([
    ...locationPlaces,
    ...stayPlaces,
    ...scheduledPlaces,
    ...flightPlaces,
  ]);

  const routes = React.useMemo(() => {
    const groundCoordinates = uniquePlaces([
      ...airportRequests
        .filter(airport => airport.id.endsWith(':arrival'))
        .flatMap(airport => (airports[airport.id] ? [airports[airport.id]] : [])),
      ...locationPlaces,
      ...stayPlaces,
      ...scheduledPlaces,
      ...airportRequests
        .filter(airport => airport.id.endsWith(':departure'))
        .flatMap(airport => (airports[airport.id] ? [airports[airport.id]] : [])),
    ]).map(place => ({ latitude: place.lat, longitude: place.lng }));
    const ground: MapRoute[] =
      groundCoordinates.length > 1
        ? [{ id: `ground:${date}`, coordinates: groundCoordinates, color: '#477d67' }]
        : [];
    const flightRoutes = flights.flatMap(flight => {
      const departure = airports[`${flight.id}:departure`];
      const arrival = airports[`${flight.id}:arrival`];
      return departure && arrival
        ? [
            {
              id: `flight:${flight.id}`,
              coordinates: [
                { latitude: departure.lat, longitude: departure.lng },
                { latitude: arrival.lat, longitude: arrival.lng },
              ],
              color: '#4d7fa3',
              dashed: true,
            },
          ]
        : [];
    });
    return [...ground, ...flightRoutes];
  }, [airportRequests, airports, date, flights, locationPlaces, scheduledPlaces, stayPlaces]);

  if (!mapPlaces.length) {
    return (
      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          No route coordinates yet
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          Add coordinates to a location or save places to this day to see the route here.
        </Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ height: 360, overflow: 'hidden', borderRadius: 20 }}>
        <TripMap fitToPlaces places={mapPlaces} routes={routes} />
      </View>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
        Green lines are the day route. Dashed blue lines are flights. Airports are found through the
        protected Places API when available.
      </Text>
    </View>
  );
}
