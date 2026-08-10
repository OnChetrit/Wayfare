export type PlaceCategory =
  'HOTEL' | 'RESTAURANT' | 'BAR' | 'CAFE' | 'ATTRACTION' | 'SHOPPING' | 'TRANSPORT' | 'CUSTOM';

export type EditorMode = 'map' | 'day' | 'places' | 'trip' | 'expenses';

export type WorkspaceView = 'map' | 'timeline';

export type PlacesFilter = 'ALL' | 'FAVORITES' | PlaceCategory;

export type ExpenseCategory =
  'FLIGHT' | 'HOTEL' | 'RESTAURANT' | 'TICKETS' | 'SHOPPING' | 'TRANSPORT' | 'OTHER';

export type Expense = {
  id: string;
  tripId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  notes?: string;
  stayId?: string;
  flightId?: string;
  scheduleItemId?: string;
};

export type SavedPlace = {
  id: string;
  name: string;
  subtitle: string;
  category: PlaceCategory;
  emoji: string;
  color: string;
  lat: number;
  lng: number;
  rating?: number;
  provider?: 'GOOGLE' | 'CUSTOM';
  providerPlaceId?: string;
  googleMapsUri?: string;
  photos?: Array<{
    url: string;
    attributions: Array<{
      name: string;
      uri?: string;
    }>;
  }>;
  isFavorite?: boolean;
  comment?: string;
  locationSegmentIds?: string[];
};

export type ScheduleItem = {
  id: string;
  savedPlaceId: string | null;
  date: string;
  startTime: string;
  duration: number;
  note?: string;
  title?: string;
  category?: PlaceCategory;
  amount?: number;
  currency?: string;
};

export type TripDay = {
  id: string;
  date: string;
  label: string;
  weekday: string;
  shortDate: string;
  notes?: string;
};

export type LocationSegment = {
  id: string;
  tripId: string;
  locationName: string;
  country?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  startDate: string;
  endDate: string;
};

export type Stay = {
  id: string;
  tripId: string;
  name: string;
  savedPlaceId: string | null;
  address?: string;
  locationLabel?: string;
  price?: string;
  priceAmount?: number;
  priceCurrency?: string;
  cancellationTime?: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  confirmationNumber?: string;
  secretCode?: string;
  notes?: string;
};

export type TripFlight = {
  id: string;
  tripId: string;
  flightNumber: string;
  airlineName?: string;
  airlineIata?: string;
  airlineIcao?: string;
  departureDate: string;
  arrivalDate?: string;
  departureAirportIata?: string;
  departureAirportIcao?: string;
  departureAirportName?: string;
  departureTimeZone?: string;
  arrivalAirportIata?: string;
  arrivalAirportIcao?: string;
  arrivalAirportName?: string;
  arrivalTimeZone?: string;
  scheduledDepartureLocal: string;
  scheduledDepartureUtc: string;
  scheduledArrivalLocal?: string;
  scheduledArrivalUtc?: string;
  revisedDepartureLocal?: string;
  revisedArrivalLocal?: string;
  departureTerminal?: string;
  departureGate?: string;
  departureCheckInDesk?: string;
  arrivalTerminal?: string;
  arrivalGate?: string;
  arrivalBaggageBelt?: string;
  status: string;
  durationMinutes?: number;
  aircraftModel?: string;
  aircraftRegistration?: string;
  lastUpdatedUtc?: string;
};

export type TripEditorUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  lastTripId?: string;
  preferences: UserPreferences;
};

export type UserPreferences = {
  timeZone: string;
  currency: string;
  theme: 'system' | 'light' | 'dark';
};

export type TripEditorTrip = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  destinationLabel: string | null;
  defaultTimeZone: string;
  defaultCurrency: string;
  days: TripDay[];
  places: SavedPlace[];
  schedule: ScheduleItem[];
  locationSegments: LocationSegment[];
  stays: Stay[];
  flights: TripFlight[];
  expenses: Expense[];
};

export type TripSummary = Pick<
  TripEditorTrip,
  'id' | 'name' | 'startDate' | 'endDate' | 'destinationLabel'
>;
