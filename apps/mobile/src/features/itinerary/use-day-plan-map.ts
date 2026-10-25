import { orderScheduleItemsForDay, type TripEditorTrip, type TripFlight } from '@wayfare/domain';
import { useQueries } from '@tanstack/react-query';
import * as React from 'react';

import { searchGooglePlaces } from '@/api/trips';
import type { MapPlace, MapRoute } from '@/components/trip-map';
import { groundRoutePlacesForDay } from '@/features/itinerary/day-route-map-data';

type Airport = {
  id: string;
  name: string;
  phase: 'arrival' | 'departure';
  query: string;
};

type DayPlanInputs = {
  airportRequests: Airport[];
  flightAirportRoutes: Airport[][];
};

type AirportCoordinates = {
  lat: number;
  lng: number;
};

const emptyDayPlanInputs: DayPlanInputs = {
  airportRequests: [],
  flightAirportRoutes: [],
};

const emptyMapPlaces: MapPlace[] = [];
const emptyMapRoutes: MapRoute[] = [];

function airportForFlight(flight: TripFlight, phase: Airport['phase']): Airport | null {
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
    phase,
    query: `${airportName ?? label}${code ? ` (${code})` : ''} airport`,
  };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map(item => [item.id, item])).values());
}

function inputsForDay(trip: TripEditorTrip, date: string): DayPlanInputs {
  const flights = trip.flights.filter(
    flight => !date || flight.departureDate === date || flight.arrivalDate === date,
  );
  const flightAirportRoutes = flights
    .map(flight => [airportForFlight(flight, 'departure'), airportForFlight(flight, 'arrival')])
    .map(route => route.filter((airport): airport is Airport => Boolean(airport)))
    .filter(route => route.length === 2);
  return {
    airportRequests: uniqueById(flightAirportRoutes.flat()),
    flightAirportRoutes,
  };
}

function mapPlaceForSavedPlace(place: TripEditorTrip['places'][number]): MapPlace {
  return {
    color: place.color,
    id: place.id,
    lat: place.lat,
    lng: place.lng,
    name: place.name,
    subtitle: place.subtitle,
  };
}

export function useDayPlanMap({
  date,
  loadAirports = false,
  trip,
}: {
  date: string | undefined;
  loadAirports?: boolean;
  trip: TripEditorTrip | undefined;
}) {
  const inputs = React.useMemo(
    () => (trip && date ? inputsForDay(trip, date) : emptyDayPlanInputs),
    [date, trip],
  );
  const airportQueries = useQueries({
    queries: inputs.airportRequests.map(airport => ({
      queryKey: ['airport-map-place', airport.query],
      queryFn: async ({ signal }): Promise<AirportCoordinates | null> => {
        const result = await searchGooglePlaces(airport.query, undefined, signal);
        const place = result[0];
        return place ? { lat: place.lat, lng: place.lng } : null;
      },
      enabled: loadAirports,
      gcTime: 30 * 60_000,
      retry: false,
      staleTime: 24 * 60 * 60_000,
    })),
  });
  const airportResultsKey = airportQueries
    .map((query, index) => {
      const airport = inputs.airportRequests[index];
      const coordinates = loadAirports ? query.data : undefined;
      return coordinates
        ? `${airport.id}:${airport.name}:${coordinates.lat}:${coordinates.lng}`
        : '';
    })
    .join('|');
  const airports = React.useMemo(
    () =>
      Object.fromEntries(
        airportQueries.flatMap((query, index) => {
          const airport = inputs.airportRequests[index];
          const coordinates = loadAirports ? query.data : undefined;
          return airport && coordinates
            ? [
                [
                  airport.id,
                  {
                    color: '#4d7fa3',
                    id: airport.id,
                    name: airport.name,
                    subtitle: 'Airport',
                    ...coordinates,
                  },
                ],
              ]
            : [];
        }),
      ) as Record<string, MapPlace>,
    // `useQueries` returns a fresh result array on each render. The stable data key prevents that
    // implementation detail from rebuilding native map inputs and retriggering camera work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [airportResultsKey, loadAirports],
  );
  const isLoadingAirports = loadAirports && airportQueries.some(query => query.isLoading);

  return React.useMemo(() => {
    if (!trip || !date)
      return {
        hasAirportRequests: false,
        isLoadingAirports: false,
        mapPlaces: emptyMapPlaces,
        routes: emptyMapRoutes,
      };

    const placesById = new Map(trip.places.map(place => [place.id, place]));
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
      .filter(
        stay =>
          stay.checkOutDate === date ||
          stay.checkInDate === date ||
          (stay.checkInDate < date && date < stay.checkOutDate),
      )
      .sort((left, right) => left.checkInDate.localeCompare(right.checkInDate))
      .flatMap(stay => {
        const place = stay.savedPlaceId ? placesById.get(stay.savedPlaceId) : undefined;
        return place ? [mapPlaceForSavedPlace(place)] : [];
      });
    const scheduledPlaces = orderScheduleItemsForDay(trip.schedule, date).flatMap(item => {
      const place = item.savedPlaceId ? placesById.get(item.savedPlaceId) : undefined;
      return place ? [mapPlaceForSavedPlace(place)] : [];
    });
    const routePlaces = groundRoutePlacesForDay(trip.schedule, trip.places, date, trip.stays).map(
      mapPlaceForSavedPlace,
    );
    const flightRoutes = inputs.flightAirportRoutes
      .map(route =>
        route
          .map(airport => airports[airport.id])
          .filter((airport): airport is MapPlace => Boolean(airport)),
      )
      .filter(route => route.length === 2)
      .map((route): MapRoute => ({
        id: `flight:${route.map(place => place.id).join(':')}`,
        coordinates: route.map(place => ({ latitude: place.lat, longitude: place.lng })),
        color: '#4d7fa3',
        dashed: true,
      }));
    const airportPlaces = inputs.airportRequests.flatMap(airport =>
      airports[airport.id] ? [airports[airport.id]] : [],
    );
    const routes: MapRoute[] = [
      ...(routePlaces.length > 1
        ? [
            {
              id: `ground:${date}`,
              coordinates: routePlaces.map(place => ({
                latitude: place.lat,
                longitude: place.lng,
              })),
              color: '#477d67',
            },
          ]
        : []),
      ...flightRoutes,
    ];

    return {
      hasAirportRequests: inputs.airportRequests.length > 0,
      isLoadingAirports,
      mapPlaces: uniqueById([
        ...locationPlaces,
        ...stayPlaces,
        ...scheduledPlaces,
        ...airportPlaces,
      ]),
      routes,
    };
  }, [airports, date, inputs, isLoadingAirports, trip]);
}
