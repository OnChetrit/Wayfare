'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type PlaceHoverContextValue = {
  hoveredPlaceId: string | null;
  setHoveredPlaceId: (placeId: string | null) => void;
};

const PlaceHoverContext = createContext<PlaceHoverContextValue | null>(null);

export function PlaceHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const value = useMemo(() => ({ hoveredPlaceId, setHoveredPlaceId }), [hoveredPlaceId]);

  return <PlaceHoverContext.Provider value={value}>{children}</PlaceHoverContext.Provider>;
}

export function usePlaceHover() {
  const context = useContext(PlaceHoverContext);
  if (!context) throw new Error('usePlaceHover must be used within PlaceHoverProvider');
  return context;
}
