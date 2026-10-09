import { orderScheduleItemsForDay, type SavedPlace, type ScheduleItem } from './index';
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
export function tripDayRoutes(
  startDate: string,
  endDate: string,
  schedule: readonly ScheduleItem[],
  places: readonly SavedPlace[],
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
      unmappedCount: activities.length - stops.length,
    });
  }
  return days;
}
export function toggleTripDay(current: string, next: string) {
  return current === next ? '' : next;
}
