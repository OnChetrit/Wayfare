import {
  tripEditorTripResponseSchema,
  createdTripInvitationSchema,
  tripInvitationSchema,
  tripMemberSchema,
  locationSegmentSchema,
  reminderSchema,
  tripSummarySchema,
  type Expense,
  type ReminderCreateInput,
  type ReminderUpdateInput,
  type LocationSegment,
  type PlaceCategory,
  type ScheduleItem,
  type SavedPlace,
  type TripEditorTrip,
  type TripFlight,
  type CreatedTripInvitation,
  type TripInvitation,
  type TripInvitationCreateInput,
  type TripMember,
  type TripMemberRoleUpdateInput,
  type TripInput,
  type TripSummary,
} from '@wayfare/domain';

import { requestWayfareApi } from '@/api/client';
export { tripKeys } from '@/api/query-keys';

type RawTripSummary = {
  id: string;
  owner_id: string;
  name: string;
  start_date: string;
  end_date: string;
  destination_label: string | null;
};

type RawLocationSegment = {
  id: string;
  trip_id: string;
  location_name: string;
  country: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string;
  end_date: string;
};

export type GooglePlaceSearchResult = Pick<
  SavedPlace,
  | 'id'
  | 'name'
  | 'subtitle'
  | 'category'
  | 'emoji'
  | 'color'
  | 'lat'
  | 'lng'
  | 'rating'
  | 'provider'
  | 'providerPlaceId'
  | 'googleMapsUri'
  | 'photos'
>;

export type GoogleMapsListImportResult = {
  listName: string;
  places: SavedPlace[];
  importedCount: number;
  skippedCount: number;
};

export type ScheduleInput = {
  date: string;
  startTime: string | null;
  duration: number;
  savedPlaceId?: string | null;
  title?: string;
  category?: PlaceCategory;
  note?: string;
  amount?: number | null;
  currency?: string;
};

export type StayInput = {
  name: string;
  savedPlaceId?: string | null;
  address?: string | null;
  locationLabel?: string | null;
  price?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string;
  cancellationTime?: string | null;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  confirmationNumber?: string | null;
  secretCode?: string | null;
  notes?: string | null;
};

export type ExpenseInput = Pick<
  Expense,
  'title' | 'category' | 'amount' | 'currency' | 'expenseDate' | 'notes'
> & {
  stayId?: string | null;
  flightId?: string | null;
  scheduleItemId?: string | null;
};

export type TripSettingsInput = Pick<
  TripEditorTrip,
  'name' | 'destinationLabel' | 'startDate' | 'endDate' | 'defaultTimeZone' | 'defaultCurrency'
>;

export type CreateTripInput = TripInput;

function mapTripSummary(raw: RawTripSummary): TripSummary {
  return tripSummarySchema.parse({
    id: raw.id,
    ownerId: raw.owner_id,
    name: raw.name,
    startDate: raw.start_date,
    endDate: raw.end_date,
    destinationLabel: raw.destination_label,
  });
}

function mapLocationSegment(raw: RawLocationSegment): LocationSegment {
  return locationSegmentSchema.parse({
    id: raw.id,
    tripId: raw.trip_id,
    locationName: raw.location_name,
    country: raw.country ?? undefined,
    area: raw.area ?? undefined,
    latitude: raw.latitude ?? undefined,
    longitude: raw.longitude ?? undefined,
    startDate: raw.start_date,
    endDate: raw.end_date,
  });
}

export async function getTrips({ signal }: { signal?: AbortSignal } = {}) {
  const response = await requestWayfareApi<{ trips: RawTripSummary[] }>('/api/trips', { signal });
  return response.trips.map(mapTripSummary) satisfies TripSummary[];
}

export async function getTripEditor(tripId: string, signal?: AbortSignal) {
  const response = await requestWayfareApi<unknown>(`/api/trips/${encodeURIComponent(tripId)}`, {
    signal,
  });
  return tripEditorTripResponseSchema.parse(response).trip as TripEditorTrip;
}

export function updateTrip(tripId: string, input: TripSettingsInput) {
  return write(tripPath(tripId, ''), 'PATCH', input);
}

export async function createTrip(input: CreateTripInput) {
  const response = await write<{ trip: RawTripSummary }>('/api/trips', 'POST', input);
  return mapTripSummary(response.trip);
}

export function deleteTrip(tripId: string) {
  return write<{ deleted: string }>(tripPath(tripId, ''), 'DELETE');
}

export function redeemTripInvitation(token: string) {
  return write<{ tripId: string }>('/api/invitations/redeem', 'POST', { token }).then(
    response => response.tripId,
  );
}

export function getTripInvitations(tripId: string, signal?: AbortSignal) {
  return requestWayfareApi<unknown>(tripPath(tripId, '/invitations'), { signal }).then(response => {
    const invitations = (response as { invitations?: unknown }).invitations;
    return tripInvitationSchema.array().parse(invitations) satisfies TripInvitation[];
  });
}

export function createTripInvitation(tripId: string, input: TripInvitationCreateInput) {
  return write<unknown>(tripPath(tripId, '/invitations'), 'POST', input).then(response =>
    createdTripInvitationSchema.parse((response as { invitation?: unknown }).invitation),
  ) as Promise<CreatedTripInvitation>;
}

export function revokeTripInvitation(tripId: string, invitationId: string) {
  return write<unknown>(
    tripPath(tripId, `/invitations/${encodeURIComponent(invitationId)}`),
    'DELETE',
  ).then(response =>
    tripInvitationSchema.parse((response as { invitation?: unknown }).invitation),
  ) as Promise<TripInvitation>;
}

export function getTripMembers(tripId: string, signal?: AbortSignal) {
  return requestWayfareApi<unknown>(tripPath(tripId, '/members'), { signal }).then(response => {
    const members = (response as { members?: unknown }).members;
    return tripMemberSchema.array().parse(members) satisfies TripMember[];
  });
}

export function updateTripMember(tripId: string, userId: string, input: TripMemberRoleUpdateInput) {
  return write<unknown>(
    tripPath(tripId, `/members/${encodeURIComponent(userId)}`),
    'PATCH',
    input,
  ).then(response =>
    tripMemberSchema.parse((response as { member?: unknown }).member),
  ) as Promise<TripMember>;
}

export function removeTripMember(tripId: string, userId: string) {
  return write<{ removed: string }>(
    tripPath(tripId, `/members/${encodeURIComponent(userId)}`),
    'DELETE',
  );
}

export function searchGooglePlaces(
  query: string,
  destination?: string | null,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({ query });
  if (destination?.trim()) searchParams.set('destination', destination.trim());
  return requestWayfareApi<{ places: GooglePlaceSearchResult[] }>(
    `/api/places?${searchParams.toString()}`,
    { signal },
  ).then(response => response.places);
}

export function getGooglePlace(providerPlaceId: string, signal?: AbortSignal) {
  return requestWayfareApi<{ place: GooglePlaceSearchResult }>(
    `/api/places/${encodeURIComponent(providerPlaceId)}`,
    { signal },
  ).then(response => response.place);
}

function tripPath(tripId: string, path: string) {
  return `/api/trips/${encodeURIComponent(tripId)}${path}`;
}

function write<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  return requestWayfareApi<T>(path, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
}

export function createPlace(
  tripId: string,
  input: {
    name: string;
    lat: number;
    lng: number;
    category: PlaceCategory;
    provider?: 'GOOGLE' | 'CUSTOM';
    providerPlaceId?: string;
  },
) {
  return write<{ place: { id: string; is_favorite: boolean } }>(
    tripPath(tripId, '/places'),
    'POST',
    input,
  );
}

export function updatePlace(
  tripId: string,
  placeId: string,
  input: { isFavorite?: boolean; comment?: string },
) {
  return write(tripPath(tripId, `/places/${encodeURIComponent(placeId)}`), 'PATCH', input);
}

export function deletePlace(tripId: string, placeId: string) {
  return write(tripPath(tripId, `/places/${encodeURIComponent(placeId)}`), 'DELETE');
}

export function importGoogleMapsList(tripId: string, url: string) {
  return write<GoogleMapsListImportResult>(tripPath(tripId, '/places/import'), 'POST', { url });
}

export function createSchedule(tripId: string, input: ScheduleInput) {
  return write<{ schedule: ScheduleItem }>(tripPath(tripId, '/schedule'), 'POST', input);
}

export function updateSchedule(
  tripId: string,
  scheduleId: string,
  input: Partial<ScheduleInput> & {
    date: string;
    startTime: string | null;
    sortOrder?: number;
    title?: string | null;
    note?: string | null;
  },
) {
  return write<{ schedule: ScheduleItem }>(
    tripPath(tripId, `/schedule/${encodeURIComponent(scheduleId)}`),
    'PATCH',
    input,
  );
}

export function deleteSchedule(tripId: string, scheduleId: string) {
  return write(tripPath(tripId, `/schedule/${encodeURIComponent(scheduleId)}`), 'DELETE');
}

export function updateDayNotes(tripId: string, dayId: string, notes: string | null) {
  return write(tripPath(tripId, `/days/${encodeURIComponent(dayId)}`), 'PATCH', { notes });
}

export function createStay(tripId: string, input: StayInput) {
  return write(tripPath(tripId, '/stays'), 'POST', input);
}

export function updateStay(tripId: string, stayId: string, input: Partial<StayInput>) {
  return write(tripPath(tripId, `/stays/${encodeURIComponent(stayId)}`), 'PATCH', input);
}

export function deleteStay(tripId: string, stayId: string) {
  return write(tripPath(tripId, `/stays/${encodeURIComponent(stayId)}`), 'DELETE');
}

export function updateLocationSegment(
  tripId: string,
  segmentId: string,
  input: Partial<
    Pick<
      LocationSegment,
      'locationName' | 'country' | 'area' | 'latitude' | 'longitude' | 'startDate' | 'endDate'
    >
  >,
) {
  return write(
    tripPath(tripId, `/location-segments/${encodeURIComponent(segmentId)}`),
    'PATCH',
    input,
  );
}

export function splitLocationSegment(
  tripId: string,
  input: { sourceSegmentId: string; splitDate: string; locationName: string },
) {
  return write(tripPath(tripId, '/location-segments'), 'POST', input);
}

export function createLocationDivision(
  tripId: string,
  input: { startDate: string; endDate: string; locationName: string },
) {
  return write<{ segments: RawLocationSegment[] }>(
    tripPath(tripId, '/location-segments/division'),
    'POST',
    input,
  ).then(response => ({ segments: response.segments.map(mapLocationSegment) }));
}

export function moveLocationBoundary(
  tripId: string,
  input: { leftSegmentId: string; rightSegmentId: string; newBoundary: string },
) {
  return write<{ segments: RawLocationSegment[] }>(
    tripPath(tripId, '/location-segments/boundary'),
    'POST',
    input,
  ).then(response => ({ segments: response.segments.map(mapLocationSegment) }));
}

export function deleteLocationSegment(
  tripId: string,
  segmentId: string,
  neighborSegmentId?: string,
) {
  return write(tripPath(tripId, `/location-segments/${encodeURIComponent(segmentId)}`), 'DELETE', {
    ...(neighborSegmentId ? { neighborSegmentId } : {}),
  });
}

export function assignPlaceToSegment(tripId: string, segmentId: string, savedPlaceId: string) {
  return write(
    tripPath(tripId, `/location-segments/${encodeURIComponent(segmentId)}/places`),
    'POST',
    { savedPlaceId },
  );
}

export function removePlaceFromSegment(tripId: string, segmentId: string, savedPlaceId: string) {
  return write(
    tripPath(tripId, `/location-segments/${encodeURIComponent(segmentId)}/places`),
    'DELETE',
    { savedPlaceId },
  );
}

export function searchFlights(tripId: string, flightNumber: string, departureDate: string) {
  return write<{ flights: Omit<TripFlight, 'id' | 'tripId'>[] }>(
    tripPath(tripId, '/flights/search'),
    'POST',
    { flightNumber, departureDate },
  );
}

export function createFlight(tripId: string, flight: Omit<TripFlight, 'id' | 'tripId'>) {
  return write(tripPath(tripId, '/flights'), 'POST', flight);
}

export function deleteFlight(tripId: string, flightId: string) {
  return write(tripPath(tripId, `/flights/${encodeURIComponent(flightId)}`), 'DELETE');
}

export function createExpense(tripId: string, input: ExpenseInput) {
  return write(tripPath(tripId, '/expenses'), 'POST', input);
}

export function updateExpense(tripId: string, expenseId: string, input: Partial<ExpenseInput>) {
  return write(tripPath(tripId, `/expenses/${encodeURIComponent(expenseId)}`), 'PATCH', input);
}

export function deleteExpense(tripId: string, expenseId: string) {
  return write(tripPath(tripId, `/expenses/${encodeURIComponent(expenseId)}`), 'DELETE');
}

export function getReminders(tripId: string, status: 'OPEN' | 'COMPLETED', signal?: AbortSignal) {
  return requestWayfareApi<{ reminders: unknown[] }>(
    `${tripPath(tripId, '/reminders')}?${new URLSearchParams({ status }).toString()}`,
    { signal },
  ).then(response => response.reminders.map(reminder => reminderSchema.parse(reminder)));
}

export type ReminderCreateRequest = Pick<
  ReminderCreateInput,
  'body' | 'remindAt' | 'savedPlaceId' | 'scheduleItemId' | 'sourceKind' | 'title'
>;

export function createReminder(tripId: string, input: ReminderCreateRequest) {
  return write<{ reminder: unknown }>(tripPath(tripId, '/reminders'), 'POST', input).then(
    response => reminderSchema.parse(response.reminder),
  );
}

export function updateReminder(tripId: string, reminderId: string, input: ReminderUpdateInput) {
  return write<{ reminder: unknown }>(
    tripPath(tripId, `/reminders/${encodeURIComponent(reminderId)}`),
    'PATCH',
    input,
  ).then(response => reminderSchema.parse(response.reminder));
}

export function deleteReminder(tripId: string, reminderId: string) {
  return write<{ deleted: string }>(
    tripPath(tripId, `/reminders/${encodeURIComponent(reminderId)}`),
    'DELETE',
  );
}
