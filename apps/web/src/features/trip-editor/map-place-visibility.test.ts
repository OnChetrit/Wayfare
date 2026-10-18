import { describe, expect, it } from 'vitest';
import type { SavedPlace } from './types';
import { visibleBaseMapPlaces } from './map-place-visibility';

const saved: SavedPlace = {
  id: 'saved',
  name: 'Saved',
  subtitle: '',
  category: 'CUSTOM',
  emoji: '⌖',
  color: '#477d67',
  lat: 1,
  lng: 1,
};
const planned = { ...saved, id: 'planned', name: 'Planned' };
const unsavedPlanned = { ...saved, id: 'unsaved-planned', name: 'Stop' };

describe('map place visibility', () => {
  const options = {
    savedPlaces: [saved, planned],
    dayPlanPlaces: [planned, unsavedPlanned],
    selectedDate: '2026-10-17',
    showingLocationPlaces: false,
  };

  it('keeps saved and planned places independently switchable', () => {
    expect(visibleBaseMapPlaces({ ...options, showSavedPlaces: true, showDayPlan: false })).toEqual([
      saved,
    ]);
    expect(visibleBaseMapPlaces({ ...options, showSavedPlaces: false, showDayPlan: true })).toEqual([
      planned,
      unsavedPlanned,
    ]);
    expect(visibleBaseMapPlaces({ ...options, showSavedPlaces: true, showDayPlan: true })).toEqual([
      saved,
      planned,
      unsavedPlanned,
    ]);
    expect(visibleBaseMapPlaces({ ...options, showSavedPlaces: false, showDayPlan: false })).toEqual(
      [],
    );
  });

  it('shows all saved places in the trip overview and limits a location view to its saved places', () => {
    expect(
      visibleBaseMapPlaces({
        ...options,
        selectedDate: '',
        showSavedPlaces: true,
        showDayPlan: true,
      }),
    ).toEqual([saved, planned]);
    expect(
      visibleBaseMapPlaces({
        ...options,
        savedPlaces: [planned],
        showingLocationPlaces: true,
        showSavedPlaces: true,
        showDayPlan: true,
      }),
    ).toEqual([planned]);
  });
});
