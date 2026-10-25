import { describe, expect, it } from 'vitest';
import { readEditorScreen, writeEditorScreen } from './editor-screen-query';
import type { LocationSegment, ScheduleItem, TripDay } from './types';

const days = [
  { id: 'day-1', date: '2026-10-25' },
  { id: 'day-2', date: '2026-10-26' },
] as TripDay[];
const locations = [{ id: 'location-1' }] as LocationSegment[];
const schedule = [{ id: 'activity-1', date: '2026-10-26' }] as ScheduleItem[];

describe('editor screen query', () => {
  it('opens a shared activity on its own day', () => {
    expect(
      readEditorScreen(
        new URLSearchParams('day=2026-10-25&location=location-1&activity=activity-1'),
        days,
        locations,
        schedule,
      ),
    ).toEqual({ date: '2026-10-26', locationId: null, activityId: 'activity-1' });
  });

  it('opens locations and days, ignoring stale identifiers', () => {
    expect(
      readEditorScreen(new URLSearchParams('location=location-1'), days, locations, schedule),
    ).toEqual({ date: '', locationId: 'location-1', activityId: null });
    expect(
      readEditorScreen(new URLSearchParams('day=2026-10-25'), days, locations, schedule),
    ).toEqual({ date: '2026-10-25', locationId: null, activityId: null });
    expect(
      readEditorScreen(
        new URLSearchParams('activity=missing&day=invalid'),
        days,
        locations,
        schedule,
      ),
    ).toEqual({ date: '', locationId: null, activityId: null });
  });

  it('preserves the trip and unrelated parameters while changing screens', () => {
    const params = writeEditorScreen(new URLSearchParams('trip=trip-1&foo=bar&day=old'), {
      date: '2026-10-26',
      locationId: null,
      activityId: 'activity-1',
    });
    expect(params.toString()).toBe('trip=trip-1&foo=bar&day=2026-10-26&activity=activity-1');
  });
});
