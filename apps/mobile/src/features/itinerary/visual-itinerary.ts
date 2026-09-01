import {
  orderScheduleItemsForDay,
  type LocationSegment,
  type ScheduleItem,
  type TripDay,
} from '@wayfare/domain';

export type LocationBoundary = {
  left: LocationSegment;
  right: LocationSegment;
  date: string;
};

export function sortScheduleForDay(schedule: ScheduleItem[], date: string) {
  return orderScheduleItemsForDay(schedule, date);
}

export function nextScheduleStartTime(schedule: ScheduleItem[], date: string) {
  const latest = schedule
    .filter(
      (item): item is ScheduleItem & { startTime: string } =>
        item.date === date && item.startTime !== null,
    )
    .sort((left, right) => left.startTime.localeCompare(right.startTime))
    .at(-1);
  if (!latest) return '09:00';

  const [hour, minute] = latest.startTime.split(':').map(Number);
  const nextMinutes = Math.min(23 * 60 + 45, hour * 60 + minute + latest.duration);
  return `${String(Math.floor(nextMinutes / 60)).padStart(2, '0')}:${String(
    nextMinutes % 60,
  ).padStart(2, '0')}`;
}

export function orderedLocationBoundaries(segments: LocationSegment[]): LocationBoundary[] {
  const ordered = [...segments].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return ordered.flatMap((left, index) => {
    const right = ordered[index + 1];
    if (!right || left.endDate !== right.startDate) return [];
    return [{ left, right, date: left.endDate }];
  });
}

export function validBoundaryDates(days: TripDay[], left: LocationSegment, right: LocationSegment) {
  return days.filter(day => day.date > left.startDate && day.date < right.endDate);
}

export function isValidLocationRange(startDate: string, endDate: string) {
  return startDate < endDate;
}
