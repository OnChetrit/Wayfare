export type {
  Expense,
  ExpenseCategory,
  LocationSegment,
  PlaceCategory,
  SavedPlace,
  ScheduleItem,
  Stay,
  TripDay,
  TripAccess,
  TripEditorTrip,
  TripEditorUser,
  TripFlight,
  TripSummary,
  UserPreferences,
} from '@wayfare/domain';

import type { PlaceCategory } from '@wayfare/domain';

export type EditorMode = 'map' | 'day' | 'places' | 'trip' | 'expenses';

export type WorkspaceView = 'map' | 'timeline';

export type PlacesFilter = 'ALL' | 'FAVORITES' | PlaceCategory;
