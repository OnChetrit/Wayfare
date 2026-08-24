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
>;

export type TripMember = {
  userId: string;
  tripId: string;
  role: TripRole;
  joinedAt: string;
  email?: string;
  name?: string;
};

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
