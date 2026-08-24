import type { LocationSegment, SavedPlace, Stay } from './types';

export type LocationDraft = {
  locationName: string;
  startDate?: string;
  endDate?: string;
};

export type StayDraft = {
  name: string;
  savedPlaceId: string | null;
  checkInDate: string;
  checkOutDate: string;
  address: string;
  locationLabel: string;
  price: string;
  priceCurrency: string;
  cancellationTime: string;
  confirmationNumber: string;
  secretCode: string;
  notes: string;
};

export type LocationEditorState = {
  mode: 'add' | 'edit';
  segmentId?: string;
  splitDate: string;
  rangeStart?: string;
  rangeEnd?: string;
  draft: LocationDraft;
};

export type StayEditorState = {
  stayId?: string;
  draft: StayDraft;
};

export type SavePlace = (place: SavedPlace) => Promise<SavedPlace>;

export type TimelineDragState = {
  left: LocationSegment;
  right: LocationSegment;
  originalBoundary: string;
  boundary: string;
  pointerStartX: number;
  dragElement: HTMLElement;
  leftBand: HTMLElement;
  rightBand: HTMLElement;
  leftWidth: number;
  rightWidth: number;
  snapOffsetX: number | null;
  sharedStay?: Stay;
  sharedStayBand?: HTMLElement;
  sharedStayWidth?: number;
};

export type StayDragState = {
  stay: Stay;
  edge: 'checkIn' | 'checkOut' | 'move';
  originalDate: string;
  date: string;
  offsetDays: number;
  pointerStartX: number;
  dragElement: HTMLElement;
  bandElement: HTMLElement;
  bandWidth: number;
  snapOffsetX: number | null;
};

export type LocationItemDragState = {
  segment: LocationSegment;
  edge: 'start' | 'end' | 'move';
  originalDate: string;
  offsetDays: number;
  pointerStartX: number;
  bandElement: HTMLElement;
  bandWidth: number;
  snapOffsetX: number | null;
};

export type SharedTimelineBoundaryDragState = {
  location: TimelineDragState;
  stay: StayDragState;
};
