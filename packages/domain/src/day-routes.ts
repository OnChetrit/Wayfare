import { orderScheduleItemsForDay, type SavedPlace, type ScheduleItem, type Stay } from './index';
export const dayRouteColors = [
  '#2563eb',
  '#c2410c',
  '#15803d',
  '#9333ea',
  '#be185d',
  '#0e7490',
  '#a16207',
  '#4f46e5',
];

/** Starts at the previous night's stay and ends at tonight's stay when mapped. */
export function dayGroundRoutePlaces(
  date: string,
  schedule: readonly ScheduleItem[],
  places: readonly SavedPlace[],
  stays: readonly Stay[] = [],
) {
  const placesById = new Map(places.map(place => [place.id, place]));
  const mappedPlace = (id: string | null | undefined) => {
    const place = id ? placesById.get(id) : undefined;
    return place && Number.isFinite(place.lat) && Number.isFinite(place.lng) ? place : undefined;
  };
  const latestStay = (matches: (stay: Stay) => boolean) =>
    stays.filter(matches).sort((a, b) => b.checkInDate.localeCompare(a.checkInDate))[0];
  const morningStay = latestStay(stay => stay.checkInDate < date && stay.checkOutDate >= date);
  const sleepingStay = latestStay(stay => stay.checkInDate <= date && date < stay.checkOutDate);
  const route = [
    mappedPlace(morningStay?.savedPlaceId),
    ...orderScheduleItemsForDay(schedule, date).map(item => mappedPlace(item.savedPlaceId)),
    mappedPlace(sleepingStay?.savedPlaceId),
  ].filter((place): place is SavedPlace => Boolean(place));
  return route.filter((place, index) => index === 0 || place.id !== route[index - 1]?.id);
}

export function tripDayRoutes(
  startDate: string,
  endDate: string,
  schedule: readonly ScheduleItem[],
  places: readonly SavedPlace[],
  stays: readonly Stay[] = [],
) {
  const days = [];
  const placesById = new Map(places.map(place => [place.id, place]));
  const end = Date.parse(`${endDate}T00:00:00Z`);
  for (
    let instant = Date.parse(`${startDate}T00:00:00Z`), index = 0;
    instant <= end;
    instant += 86400000, index++
  ) {
    const date = new Date(instant).toISOString().slice(0, 10);
    const activities = orderScheduleItemsForDay([...schedule], date);
    const stops = activities.flatMap(item => {
      const place = item.savedPlaceId ? placesById.get(item.savedPlaceId) : undefined;
      return place && Number.isFinite(place.lat) && Number.isFinite(place.lng)
        ? [{ itemId: item.id, place }]
        : [];
    });
    days.push({
      date,
      dayNumber: index + 1,
      color: dayRouteColors[index % dayRouteColors.length],
      activities,
      stops,
      routePlaces: dayGroundRoutePlaces(date, schedule, places, stays),
      unmappedCount: activities.length - stops.length,
    });
  }
  return days;
}
export function toggleTripDay(current: string, next: string) {
  return current === next ? '' : next;
}
