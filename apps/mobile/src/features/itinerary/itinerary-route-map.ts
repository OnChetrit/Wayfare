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
  const days = tripDayRoutes(trip.startDate, trip.endDate, trip.schedule, trip.places);
  const visibleDays = days.filter(day => !date || day.date === date);
  const places = visibleDays.flatMap(day =>
    day.stops.map((stop, index) => ({
      ...stop.place,
      id: `${day.date}:${stop.itemId}`,
      sourcePlaceId: stop.place.id,
      badge: date ? String(index + 1) : String(day.dayNumber),
      name: `Day ${day.dayNumber} · Stop ${index + 1} · ${stop.place.name}`,
      color: day.color,
    })),
  );
  const routes = visibleDays.map(day => ({
    id: day.date,
    color: day.color,
    coordinates: day.stops.map(stop => ({
      latitude: stop.place.lat,
      longitude: stop.place.lng,
    })),
  }));

  return { days, places, routes };
}
