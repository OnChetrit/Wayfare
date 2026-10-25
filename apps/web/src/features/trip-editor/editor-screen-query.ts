import type { LocationSegment, ScheduleItem, TripDay } from './types';

export type EditorScreen = {
  date: string;
  locationId: string | null;
  activityId: string | null;
};

export function readEditorScreen(
  params: URLSearchParams,
  days: TripDay[],
  locations: LocationSegment[],
  schedule: ScheduleItem[],
): EditorScreen {
  const activity = schedule.find(item => item.id === params.get('activity'));
  const location = locations.find(item => item.id === params.get('location'));
  const day = days.find(item => item.date === params.get('day'));

  if (activity && days.some(item => item.date === activity.date)) {
    return { date: activity.date, locationId: null, activityId: activity.id };
  }
  if (location) return { date: '', locationId: location.id, activityId: null };
  return { date: day?.date ?? '', locationId: null, activityId: null };
}

export function writeEditorScreen(params: URLSearchParams, screen: EditorScreen) {
  const next = new URLSearchParams(params);
  next.delete('day');
  next.delete('location');
  next.delete('activity');
  if (screen.activityId) {
    next.set('day', screen.date);
    next.set('activity', screen.activityId);
  } else if (screen.locationId) {
    next.set('location', screen.locationId);
  } else if (screen.date) {
    next.set('day', screen.date);
  }
  return next;
}
