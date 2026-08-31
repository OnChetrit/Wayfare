import { z } from 'zod';

export const placeCategories = [
  'HOTEL',
  'RESTAURANT',
  'BAR',
  'CAFE',
  'ATTRACTION',
  'SHOPPING',
  'TRANSPORT',
  'CUSTOM',
] as const;

export const expenseCategories = [
  'FLIGHT',
  'HOTEL',
  'RESTAURANT',
  'TICKETS',
  'SHOPPING',
  'TRANSPORT',
  'OTHER',
] as const;

export const tripRoles = ['OWNER', 'EDITOR', 'VIEWER'] as const;
export const invitationRoles = ['EDITOR', 'VIEWER'] as const;

export type PlaceCategory = (typeof placeCategories)[number];
export type ExpenseCategory = (typeof expenseCategories)[number];
export type TripRole = (typeof tripRoles)[number];
export type InvitationRole = (typeof invitationRoles)[number];

export const placeCategorySchema = z.enum(placeCategories);
export const expenseCategorySchema = z.enum(expenseCategories);
export const tripRoleSchema = z.enum(tripRoles);
export const invitationRoleSchema = z.enum(invitationRoles);
export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

export const tripInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    destinationLabel: z.string().trim().min(1).max(120).optional(),
    defaultTimeZone: z.string().trim().min(1).max(120).default('Europe/Madrid'),
    defaultCurrency: currencyCodeSchema.default('EUR'),
  })
  .refine(value => value.startDate <= value.endDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

export const placeInputSchema = z.object({
  provider: z.enum(['GOOGLE', 'CUSTOM']).default('CUSTOM'),
  providerPlaceId: z.string().trim().min(1).max(200).optional(),
  category: placeCategorySchema,
  name: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(500).optional(),
  lat: z.number().finite().gte(-90).lte(90),
  lng: z.number().finite().gte(-180).lte(180),
  notes: z.string().trim().max(2000).optional(),
});

export const activityInputSchema = z.object({
  dayId: z.uuid(),
  savedPlaceId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  category: placeCategorySchema.optional(),
  startAtUtc: z.iso.datetime({ offset: true }).nullable().optional(),
  timeZone: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().positive().max(1440).default(60),
  sortOrder: z.number().int().nonnegative(),
  notes: z.string().trim().max(2000).optional(),
  amount: z.number().finite().nonnegative().nullable().optional(),
  currency: currencyCodeSchema.nullable().optional(),
});

export const expenseInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: expenseCategorySchema,
  amount: z.number().finite().nonnegative(),
  currency: currencyCodeSchema,
  expenseDate: z.iso.date(),
  notes: z.string().trim().max(2000).optional(),
  stayId: z.uuid().nullable().optional(),
  flightId: z.uuid().nullable().optional(),
  scheduleItemId: z.uuid().nullable().optional(),
});

export type TripDay = {
  id: string;
  date: string;
  label: string;
  weekday: string;
  shortDate: string;
  notes?: string;
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
  photos?: Array<{ url: string; attributions: Array<{ name: string; uri?: string }> }>;
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
  sortOrder?: number;
  note?: string;
  title?: string;
  category?: PlaceCategory;
  amount?: number;
  currency?: string;
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

export type UserPreferences = {
  timeZone: string;
  currency: string;
  theme: 'system' | 'light' | 'dark';
};

export type TripEditorUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  lastTripId?: string;
  preferences: UserPreferences;
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
> & { ownerId: string };

export type TripInput = z.output<typeof tripInputSchema>;

export type TripMember = {
  userId: string;
  tripId: string;
  role: TripRole;
  joinedAt: string;
  email?: string;
  name?: string;
};

/** Runtime contracts shared by API clients. Keep API-shaped trip data camel-cased. */
export const tripSummarySchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  name: z.string(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  destinationLabel: z.string().nullable(),
});

export const tripDaySchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  label: z.string(),
  weekday: z.string(),
  shortDate: z.string(),
  notes: z.string().optional(),
});

export const savedPlaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  subtitle: z.string(),
  category: placeCategorySchema,
  emoji: z.string(),
  color: z.string(),
  lat: z.number().finite(),
  lng: z.number().finite(),
  rating: z.number().finite().optional(),
  provider: z.enum(['GOOGLE', 'CUSTOM']).optional(),
  providerPlaceId: z.string().optional(),
  googleMapsUri: z.string().optional(),
  photos: z
    .array(
      z.object({
        url: z.string(),
        attributions: z.array(z.object({ name: z.string(), uri: z.string().optional() })),
      }),
    )
    .optional(),
  isFavorite: z.boolean().optional(),
  comment: z.string().optional(),
  locationSegmentIds: z.array(z.uuid()).optional(),
});

export const scheduleItemSchema = z.object({
  id: z.uuid(),
  savedPlaceId: z.uuid().nullable(),
  date: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.number().int().positive(),
  sortOrder: z.number().int().nonnegative().optional(),
  note: z.string().optional(),
  title: z.string().optional(),
  category: placeCategorySchema.optional(),
  amount: z.number().finite().optional(),
  currency: currencyCodeSchema.optional(),
});

export const locationSegmentSchema = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  locationName: z.string(),
  country: z.string().optional(),
  area: z.string().optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

export const staySchema = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  name: z.string(),
  savedPlaceId: z.uuid().nullable(),
  address: z.string().optional(),
  locationLabel: z.string().optional(),
  price: z.string().optional(),
  priceAmount: z.number().finite().optional(),
  priceCurrency: currencyCodeSchema.optional(),
  cancellationTime: z.string().optional(),
  checkInDate: z.iso.date(),
  checkOutDate: z.iso.date(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  confirmationNumber: z.string().optional(),
  secretCode: z.string().optional(),
  notes: z.string().optional(),
});

export const tripFlightSchema = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  flightNumber: z.string(),
  airlineName: z.string().optional(),
  airlineIata: z.string().optional(),
  airlineIcao: z.string().optional(),
  departureDate: z.iso.date(),
  arrivalDate: z.iso.date().optional(),
  departureAirportIata: z.string().optional(),
  departureAirportIcao: z.string().optional(),
  departureAirportName: z.string().optional(),
  departureTimeZone: z.string().optional(),
  arrivalAirportIata: z.string().optional(),
  arrivalAirportIcao: z.string().optional(),
  arrivalAirportName: z.string().optional(),
  arrivalTimeZone: z.string().optional(),
  scheduledDepartureLocal: z.string(),
  scheduledDepartureUtc: z.iso.datetime({ offset: true }),
  scheduledArrivalLocal: z.string().optional(),
  scheduledArrivalUtc: z.iso.datetime({ offset: true }).optional(),
  revisedDepartureLocal: z.string().optional(),
  revisedArrivalLocal: z.string().optional(),
  departureTerminal: z.string().optional(),
  departureGate: z.string().optional(),
  departureCheckInDesk: z.string().optional(),
  arrivalTerminal: z.string().optional(),
  arrivalGate: z.string().optional(),
  arrivalBaggageBelt: z.string().optional(),
  status: z.string(),
  durationMinutes: z.number().int().positive().optional(),
  aircraftModel: z.string().optional(),
  aircraftRegistration: z.string().optional(),
  lastUpdatedUtc: z.iso.datetime({ offset: true }).optional(),
});

export const expenseSchema = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  title: z.string(),
  category: expenseCategorySchema,
  amount: z.number().finite(),
  currency: currencyCodeSchema,
  expenseDate: z.iso.date(),
  notes: z.string().optional(),
  stayId: z.uuid().optional(),
  flightId: z.uuid().optional(),
  scheduleItemId: z.uuid().optional(),
});

export const tripEditorTripSchema = z.object({
  // Ownership is needed in the trip list for client-side control visibility.
  // Do not require it in the detail response: deployed clients and servers may
  // legitimately be on different releases during a mobile rollout.
  ...tripSummarySchema.omit({ ownerId: true }).shape,
  defaultTimeZone: z.string(),
  defaultCurrency: currencyCodeSchema,
  days: z.array(tripDaySchema),
  places: z.array(savedPlaceSchema),
  schedule: z.array(scheduleItemSchema),
  locationSegments: z.array(locationSegmentSchema),
  stays: z.array(staySchema),
  flights: z.array(tripFlightSchema),
  expenses: z.array(expenseSchema),
});

export const tripEditorTripResponseSchema = z.object({ trip: tripEditorTripSchema });

export type TripInvitation = {
  id: string;
  tripId: string;
  token: string;
  role: InvitationRole;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  maxUses?: number;
  useCount: number;
};

export type QueueOperation = {
  id: string;
  sequence: number;
  table: string;
  kind: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
};

export function currencyTotals(expenses: Expense[]) {
  return expenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.currency] = (totals[expense.currency] ?? 0) + expense.amount;
    return totals;
  }, {});
}

export function sortQueueOperations(operations: QueueOperation[]) {
  return [...operations].sort(
    (a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt),
  );
}

/**
 * Returns a day's itinerary in its stable, chronological display order without
 * mutating the API data array.
 */
export function orderScheduleItemsForDay(items: ScheduleItem[], date: string) {
  return items
    .filter(item => item.date === date)
    .sort(
      (left, right) =>
        left.startTime.localeCompare(right.startTime) ||
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
        left.id.localeCompare(right.id),
    );
}

/**
 * Lists the saved places a day route should visit: the hotel the traveler woke
 * up in, chronological scheduled places, then the hotel where they are staying
 * that night. Repeated IDs are intentional: they preserve return legs.
 */
export function dayRouteSavedPlaceIds(schedule: ScheduleItem[], stays: Stay[], date: string) {
  const stayOrder = (left: Stay, right: Stay) =>
    right.checkInDate.localeCompare(left.checkInDate) ||
    right.checkOutDate.localeCompare(left.checkOutDate) ||
    left.id.localeCompare(right.id);
  const wakingStay = stays
    .filter(stay => stay.checkInDate < date && date <= stay.checkOutDate)
    .sort(stayOrder)[0];
  const overnightStay = stays
    .filter(stay => stay.checkInDate <= date && date < stay.checkOutDate)
    .sort(stayOrder)[0];

  return [
    ...(wakingStay?.savedPlaceId ? [wakingStay.savedPlaceId] : []),
    ...orderScheduleItemsForDay(schedule, date).flatMap(item =>
      item.savedPlaceId ? [item.savedPlaceId] : [],
    ),
    ...(overnightStay?.savedPlaceId ? [overnightStay.savedPlaceId] : []),
  ];
}

export function makeTripDays(startDate: string, endDate: string) {
  if (
    !z.iso.date().safeParse(startDate).success ||
    !z.iso.date().safeParse(endDate).success ||
    startDate > endDate
  )
    return [];
  const days: string[] = [];
  const day = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  while (day <= end) {
    days.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return days;
}
