import { describe, expect, it } from 'vitest';

import { mapPlacesForExplore } from './saved-place-map';

describe('mapPlacesForExplore', () => {
  const savedPlace = {
    category: 'CAFE' as const,
    color: '#E7B96F',
    emoji: '☕',
    id: 'saved-cafe',
    lat: 41.9,
    lng: 12.5,
    name: 'Saved cafe',
    subtitle: 'Rome',
  };

  it('keeps the selected place at the front while avoiding duplicate markers', () => {
    expect(
      mapPlacesForExplore([savedPlace], {
        ...savedPlace,
        name: 'Updated cafe',
      }),
    ).toEqual([
      {
        color: '#E7B96F',
        id: 'saved-cafe',
        lat: 41.9,
        lng: 12.5,
        name: 'Updated cafe',
        subtitle: 'Rome',
      },
    ]);
  });

  it('includes a searched place alongside all saved markers', () => {
    expect(
      mapPlacesForExplore([savedPlace], {
        color: '#E8795D',
        id: 'search-result',
        lat: 41.91,
        lng: 12.51,
        name: 'Search result',
        subtitle: 'Rome',
      }),
    ).toHaveLength(2);
  });
});
