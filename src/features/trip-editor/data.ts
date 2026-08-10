import type { PlaceCategory } from './types';

export const categoryMeta: Record<PlaceCategory, { label: string; emoji: string; color: string }> =
  {
    HOTEL: { label: 'Stay', emoji: '⌂', color: '#9b7bc4' },
    RESTAURANT: { label: 'Food', emoji: '✦', color: '#e8795d' },
    BAR: { label: 'Drinks', emoji: '◌', color: '#d7a936' },
    CAFE: { label: 'Coffee', emoji: '☕', color: '#a87552' },
    ATTRACTION: { label: 'See', emoji: '✧', color: '#5d9bd2' },
    SHOPPING: { label: 'Shop', emoji: '◇', color: '#d17eb1' },
    TRANSPORT: { label: 'Move', emoji: '↗', color: '#6a9c88' },
    CUSTOM: { label: 'Other', emoji: '＋', color: '#8e9992' },
  };
