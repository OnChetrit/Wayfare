import { tripDayRoutes, type TripEditorTrip } from '@wayfare/domain';

import type { MapPlace, MapRoute } from '@/components/trip-map';

export function itineraryRouteMapData(
  trip: TripEditorTrip,
  date = '',
): {
  days: ReturnType<typeof tripDayRoutes>;
  places: MapPlace[];
  routes: MapRoute[];
} {
  const days = tripDayRoutes(trip.startDate, trip.endDate, trip.schedule, trip.places, trip.stays);
  const visibleDays = days.filter(day => !date || day.date === date);
  const places = visibleDays.flatMap(day => {
    const activityPlaces = day.stops.map((stop, index) => ({
      ...stop.place,
      id: `${day.date}:${stop.itemId}`,
      sourcePlaceId: stop.place.id,
      badge: date ? String(index + 1) : String(day.dayNumber),
      name: `Day ${day.dayNumber} · Stop ${index + 1} · ${stop.place.name}`,
      color: day.color,
    }));
    const stayPlaces = day.routePlaces
      .filter(place => !day.stops.some(stop => stop.place.id === place.id))
      .filter(
        (place, index, all) => all.findIndex(candidate => candidate.id === place.id) === index,
      )
      .map(place => ({
        ...place,
        id: `${day.date}:stay:${place.id}`,
        sourcePlaceId: place.id,
        name: `Day ${day.dayNumber} · Stay · ${place.name}`,
        color: day.color,
      }));
    return [...activityPlaces, ...stayPlaces];
  });
  const routes = visibleDays.map(day => ({
    id: day.date,
    color: day.color,
    coordinates: day.routePlaces.map(place => ({
      latitude: place.lat,
      longitude: place.lng,
    })),
  }));

  return { days, places, routes };
}
