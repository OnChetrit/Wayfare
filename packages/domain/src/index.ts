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
export const reminderSourceKinds = ['SAVED_PLACE', 'SCHEDULE_ITEM'] as const;
export const reminderStatuses = ['OPEN', 'COMPLETED'] as const;

export type PlaceCategory = (typeof placeCategories)[number];
export type ExpenseCategory = (typeof expenseCategories)[number];
export type TripRole = (typeof tripRoles)[number];
export type InvitationRole = (typeof invitationRoles)[number];
export type ReminderSourceKind = (typeof reminderSourceKinds)[number];
export type ReminderStatus = (typeof reminderStatuses)[number];

export const placeCategorySchema = z.enum(placeCategories);
export const expenseCategorySchema = z.enum(expenseCategories);
export const tripRoleSchema = z.enum(tripRoles);
export const invitationRoleSchema = z.enum(invitationRoles);
export const reminderSourceKindSchema = z.enum(reminderSourceKinds);
export const reminderStatusSchema = z.enum(reminderStatuses);
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

const utcReminderTimeSchema = z.iso
  .datetime({ offset: true })
  .refine(value => value.endsWith('Z'), 'Use a UTC timestamp ending in Z.');

const futureUtcReminderTimeSchema = utcReminderTimeSchema.refine(
  value => new Date(value).getTime() > Date.now(),
  'Choose a reminder time in the future.',
);

const reminderSourceInputShape = {
  savedPlaceId: z.uuid().nullable().default(null),
  scheduleItemId: z.uuid().nullable().default(null),
};

function sourceKindMatchesReferences(value: {
  sourceKind: ReminderSourceKind;
  savedPlaceId: string | null;
  scheduleItemId: string | null;
}) {
  return value.sourceKind === 'SAVED_PLACE'
    ? Boolean(value.savedPlaceId) && !value.scheduleItemId
    : Boolean(value.scheduleItemId) && !value.savedPlaceId;
}

/** Input accepted when a member turns a current shared note into a personal reminder. */
export const reminderCreateSchema = z
  .object({
    sourceKind: reminderSourceKindSchema,
    ...reminderSourceInputShape,
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().max(5_000),
    remindAt: futureUtcReminderTimeSchema,
  })
  .refine(sourceKindMatchesReferences, {
    message: 'The reminder source kind must match exactly one source.',
    path: ['sourceKind'],
  });

/** Input accepted when changing a personal reminder. Sources and snapshots never change. */
export const reminderUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().max(5_000).optional(),
    remindAt: futureUtcReminderTimeSchema.optional(),
    status: reminderStatusSchema.optional(),
  })
  .refine(
    value =>
      value.title !== undefined ||
      value.body !== undefined ||
      value.remindAt !== undefined ||
      value.status !== undefined,
    'Provide at least one reminder change.',
  );

/** The serialized personal reminder returned to web and mobile clients. */
export const reminderSchema = z
  .object({
    id: z.uuid(),
    tripId: z.uuid(),
    userId: z.uuid(),
    sourceKind: reminderSourceKindSchema,
    savedPlaceId: z.uuid().nullable(),
    scheduleItemId: z.uuid().nullable(),
    sourceTitleSnapshot: z.string().trim().min(1).max(200),
    sourceBodySnapshot: z.string().trim().min(1).max(5_000),
    sourceTitle: z.string().trim().min(1).max(200),
    sourceAvailable: z.boolean(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().max(5_000),
    remindAt: utcReminderTimeSchema,
    status: reminderStatusSchema,
    completedAt: utcReminderTimeSchema.nullable(),
    createdAt: utcReminderTimeSchema,
    updatedAt: utcReminderTimeSchema,
  })
  .refine(
    value =>
      (value.status === 'OPEN' && value.completedAt === null) ||
      (value.status === 'COMPLETED' && value.completedAt !== null),
    {
      message: 'Completed reminders must have a completion timestamp.',
      path: ['completedAt'],
    },
  );

export type Reminder = z.output<typeof reminderSchema>;
export type ReminderCreateInput = z.output<typeof reminderCreateSchema>;
export type ReminderUpdateInput = z.output<typeof reminderUpdateSchema>;

/** Returns the completion timestamp implied by an OPEN/COMPLETED status transition. */
export function reminderCompletionTime(
  previousStatus: ReminderStatus,
  nextStatus: ReminderStatus,
  previousCompletedAt: string | null,
  now = new Date(),
) {
  if (nextStatus === 'OPEN') return null;
  if (previousStatus === 'COMPLETED' && previousCompletedAt) return previousCompletedAt;
  return now.toISOString();
}

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
  /** A local trip time, or `null` when this activity can happen at any time. */
  startTime: string | null;
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
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
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

type ScheduleItemForDayOrdering = Pick<
  ScheduleItem,
  'date' | 'id' | 'savedPlaceId' | 'sortOrder' | 'startTime'
>;

function scheduleSortOrder(item: ScheduleItemForDayOrdering) {
  // Legacy responses without a server-issued sort order belong after explicit
  // manual positions. Their ID remains the stable final tie-breaker.
  return item.sortOrder ?? Number.POSITIVE_INFINITY;
}

/**
 * Returns a day's itinerary in its stable manual display order without mutating
 * the API data array. A time is a marker on an activity, not a rule that moves
 * it past an untimed activity; the server-owned manual order always comes first.
 */
export function orderScheduleItemsForDay<T extends ScheduleItemForDayOrdering>(
  items: readonly T[],
  date: string,
) {
  return items
    .filter(item => item.date === date)
    .sort((left, right) => {
      const manualOrder = scheduleSortOrder(left) - scheduleSortOrder(right);
      if (manualOrder) return manualOrder;

      if (left.startTime !== null && right.startTime !== null) {
        const timeComparison = left.startTime.localeCompare(right.startTime);
        if (timeComparison) return timeComparison;
      }

      return left.id.localeCompare(right.id);
    });
}

/**
 * Lists only the scheduled saved places a green ground route should visit.
 * Manual activities without a saved place are intentionally skipped without
 * breaking the path between the remaining mappable stops.
 */
export function dayRouteSavedPlaceIds<T extends ScheduleItemForDayOrdering>(
  schedule: readonly T[],
  date: string,
) {
  return orderScheduleItemsForDay(schedule, date).flatMap(item =>
    item.savedPlaceId ? [item.savedPlaceId] : [],
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
