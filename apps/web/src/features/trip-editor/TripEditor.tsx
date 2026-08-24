'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import styles from './TripEditor.module.scss';
import { ActivityEditor, type ActivityDraft, type ActivityEditorKind } from './ActivityEditor';
import type { LocationDraft, StayDraft } from './DateBar';
import { DateBar } from './DateBar';
import { DayNotesEditor } from './DayNotesEditor';
import { DayPlanPanel } from './DayPlanPanel';
import { LocationPlanPanel } from './LocationPlanPanel';
import { PlaceHoverProvider } from './PlaceHoverContext';
import { PlacesPanel } from './PlacesPanel';
import { useTripHeaderLayout } from './TripHeaderLayout';
import { TripSettingsModal } from './TripSettingsModal';
import { UserModal } from './UserModal';
import { createClient } from '@/lib/supabase/client';
import { parseAmount } from '@/lib/trips/amounts';
import { expenseFromDatabase } from '@/lib/trips/expenses';
import type {
  EditorMode,
  PlacesFilter,
  SavedPlace,
  ScheduleItem,
  LocationSegment,
  Stay,
  TripFlight,
  Expense,
  TripEditorTrip,
  TripEditorUser,
  TripSummary,
} from './types';

const AddTripFlow = dynamic(() => import('./AddTripFlow').then(module => module.AddTripFlow));
const ExpensesPanel = dynamic(() => import('./ExpensesPanel').then(module => module.ExpensesPanel));
const TimelineView = dynamic(() => import('./TimelineView').then(module => module.TimelineView));
const MapPanel = dynamic(() => import('./MapPanel').then(module => module.MapPanel), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading} role="status" aria-live="polite">
      Loading map…
    </div>
  ),
});
export type TripEditorProps = {
  user: TripEditorUser;
  initialTrip: TripEditorTrip | null;
  trips: TripSummary[];
  initialMode?: EditorMode;
  tripBackHref?: string;
};

export function TripEditor({
  user,
  initialTrip,
  trips,
  initialMode = 'map',
  tripBackHref,
}: TripEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [themePreference, setThemePreference] = useState(user.preferences.theme);
  const [trip, setTrip] = useState(initialTrip);
  const currentTrip = trip ?? initialTrip;
  const days = currentTrip?.days ?? [];
  const [selectedDate, setSelectedDate] = useState(currentTrip?.days[0]?.date ?? '');
  const [places, setPlaces] = useState<SavedPlace[]>(initialTrip?.places ?? []);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialTrip?.schedule ?? []);
  const [locationSegments, setLocationSegments] = useState<LocationSegment[]>(
    initialTrip?.locationSegments ?? [],
  );
  const [stays, setStays] = useState<Stay[]>(initialTrip?.stays ?? []);
  const [flights, setFlights] = useState<TripFlight[]>(initialTrip?.flights ?? []);
  const [expenses, setExpenses] = useState<Expense[]>(initialTrip?.expenses ?? []);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlacesFilter>('ALL');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [previewPlace, setPreviewPlace] = useState<SavedPlace | null>(null);
  const [mode, setMode] = useState<EditorMode>(initialMode);
  const [accountOpen, setAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFlightDate, setSettingsFlightDate] = useState<string | undefined>();
  const [activityEditorOpen, setActivityEditorOpen] = useState<ActivityEditorKind | null>(null);
  const [dayNotesOpen, setDayNotesOpen] = useState(false);
  const [showDayPlanOnly, setShowDayPlanOnly] = useState(true);
  const [showOnlyVisiblePlaces, setShowOnlyVisiblePlaces] = useState(false);
  const [visibleMapPlaceIds, setVisibleMapPlaceIds] = useState<string[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSavedTripId = useRef(user.lastTripId);
  const workspaceTripId = useRef(currentTrip?.id);
  const { workspaceView, setWorkspaceView } = useTripHeaderLayout({
    user,
    trip: currentTrip,
    trips,
    onOpenAccount: () => setAccountOpen(true),
    onOpenSettings: currentTrip ? () => openTripSettings() : undefined,
    mode,
    onModeChange: changeMode,
  });

  useEffect(() => {
    const tripId = currentTrip?.id;
    if (!tripId || lastSavedTripId.current === tripId) return;

    lastSavedTripId.current = tripId;
    void createClient()
      .auth.updateUser({ data: { lastTripId: tripId } })
      .then(({ error }) => {
        if (error) lastSavedTripId.current = user.lastTripId;
      });
  }, [currentTrip?.id, user.lastTripId]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme() {
      const resolvedTheme =
        themePreference === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : themePreference;
      root.dataset.theme = resolvedTheme;
      root.style.colorScheme = resolvedTheme;
    }

    function handleSystemThemeChange() {
      if (themePreference === 'system') applyTheme();
    }

    applyTheme();
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [themePreference]);

  useEffect(() => {
    if (workspaceTripId.current === currentTrip?.id) return;

    workspaceTripId.current = currentTrip?.id;
    setWorkspaceView('map');
  }, [currentTrip?.id, setWorkspaceView]);

  function updateTheme(theme: TripEditorUser['preferences']['theme']) {
    setThemePreference(theme);
    try {
      window.localStorage.setItem('wayfare-theme', theme);
    } catch {
      // The active theme still applies when storage is unavailable.
    }
  }

  useGSAP(
    () => {
      gsap.fromTo(
        '[data-enter]',
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'power2.out' },
      );
    },
    { scope: editorRef },
  );

  const selectedDay = days.find(day => day.date === selectedDate) ?? null;
  const activeLocation = useMemo(
    () => locationSegments.find(segment => segment.id === selectedLocationId) ?? null,
    [locationSegments, selectedLocationId],
  );
  const selectedSchedule = schedule
    .filter(item => item.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const selectedFlights = flights
    .filter(flight => flight.departureDate === selectedDate || flight.arrivalDate === selectedDate)
    .sort((a, b) => a.scheduledDepartureUtc.localeCompare(b.scheduledDepartureUtc));
  const firstDayDate = days[0]?.date;
  const lastDayDate = days[days.length - 1]?.date;
  const hasArrivalFlight = Boolean(
    firstDayDate &&
    flights.some(
      flight => flight.departureDate === firstDayDate || flight.arrivalDate === firstDayDate,
    ),
  );
  const hasDepartureFlight = Boolean(
    lastDayDate && flights.some(flight => flight.departureDate === lastDayDate),
  );
  const scheduledPlaceIds = useMemo(
    () =>
      new Set(
        schedule
          .map(item => item.savedPlaceId)
          .filter((placeId): placeId is string => Boolean(placeId)),
      ),
    [schedule],
  );
  const filteredPlaces = useMemo(
    () =>
      places.filter(place => {
        const matchesCategory =
          filter === 'ALL' || filter === 'FAVORITES' || place.category === filter;
        const matchesFavorites = filter !== 'FAVORITES' || place.isFavorite === true;
        const query = libraryQuery.toLowerCase().trim();
        return (
          matchesCategory &&
          matchesFavorites &&
          !scheduledPlaceIds.has(place.id) &&
          (!showOnlyVisiblePlaces || visibleMapPlaceIds.includes(place.id)) &&
          (!query || `${place.name} ${place.subtitle}`.toLowerCase().includes(query))
        );
      }),
    [filter, libraryQuery, places, scheduledPlaceIds, showOnlyVisiblePlaces, visibleMapPlaceIds],
  );

  function selectDay(date: string) {
    startTransition(() => {
      setSelectedDate(date);
      setSelectedLocationId(null);
      setSelectedPlaceId(null);
      setPreviewPlace(null);
      setShowDayPlanOnly(true);
      setMode('day');
    });
  }

  function selectLocation(location: LocationSegment) {
    setSelectedLocationId(location.id);
    setSelectedPlaceId(null);
    setPreviewPlace(null);
    setMode('day');
  }

  function selectPlace(place: SavedPlace) {
    setSelectedPlaceId(place.id);
    setPreviewPlace(place);
    setWorkspaceView('map');
    setMode('map');
  }

  async function savePlace(place: SavedPlace): Promise<SavedPlace> {
    const existingPlace = places.find(
      item =>
        item.id === place.id ||
        (item.providerPlaceId && item.providerPlaceId === place.providerPlaceId),
    );
    if (existingPlace) return existingPlace;
    let savedPlace = place;
    if (initialTrip) {
      const response = await fetch(`/api/trips/${initialTrip.id}/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(place),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        place?: { id?: string };
      };
      if (!response.ok || !payload.place?.id)
        throw new Error('Could not save this place to your trip.');
      savedPlace = { ...place, id: payload.place.id, isFavorite: false };
    }
    setPlaces(items =>
      items.some(
        item =>
          item.id === savedPlace.id ||
          (item.providerPlaceId && item.providerPlaceId === savedPlace.providerPlaceId),
      )
        ? items
        : [...items, savedPlace],
    );
    return savedPlace;
  }

  async function toggleFavorite(place: SavedPlace) {
    const nextIsFavorite = !place.isFavorite;
    setPlaces(current =>
      current.map(item => (item.id === place.id ? { ...item, isFavorite: nextIsFavorite } : item)),
    );
    if (!initialTrip) return;
    try {
      await requestJson(`/api/trips/${initialTrip.id}/places/${place.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: nextIsFavorite }),
      });
    } catch (error) {
      setPlaces(current =>
        current.map(item =>
          item.id === place.id ? { ...item, isFavorite: place.isFavorite } : item,
        ),
      );
      showTimelineError(error);
    }
  }

  async function savePlaceComment(place: SavedPlace, comment: string): Promise<SavedPlace> {
    const savedPlace = await savePlace(place);
    const previousComment = savedPlace.comment;
    const normalizedComment = comment.trim();
    const updatedPlace = { ...savedPlace, comment: normalizedComment || undefined };
    setPlaces(current => current.map(item => (item.id === savedPlace.id ? updatedPlace : item)));
    setPreviewPlace(current =>
      current &&
      (current.id === savedPlace.id ||
        (current.providerPlaceId && current.providerPlaceId === savedPlace.providerPlaceId))
        ? { ...current, comment: updatedPlace.comment }
        : current,
    );
    if (!initialTrip) return updatedPlace;

    try {
      await requestJson(`/api/trips/${initialTrip.id}/places/${savedPlace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: normalizedComment }),
      });
      return updatedPlace;
    } catch (error) {
      setPlaces(current =>
        current.map(item =>
          item.id === savedPlace.id ? { ...item, comment: previousComment } : item,
        ),
      );
      setPreviewPlace(current =>
        current &&
        (current.id === savedPlace.id ||
          (current.providerPlaceId && current.providerPlaceId === savedPlace.providerPlaceId))
          ? { ...current, comment: previousComment }
          : current,
      );
      throw error;
    }
  }

  async function deletePlace(place: SavedPlace) {
    const previousPlaces = places;
    const previousSchedule = schedule;
    const previousStays = stays;
    setPlaces(current => current.filter(item => item.id !== place.id));
    setSchedule(current => current.filter(item => item.savedPlaceId !== place.id));
    setStays(current =>
      current.map(stay =>
        stay.savedPlaceId === place.id ? { ...stay, savedPlaceId: null } : stay,
      ),
    );
    if (selectedPlaceId === place.id) setSelectedPlaceId(null);
    if (previewPlace?.id === place.id) setPreviewPlace(null);
    if (!initialTrip) return;
    try {
      await requestJson(`/api/trips/${initialTrip.id}/places/${place.id}`, { method: 'DELETE' });
    } catch (error) {
      setPlaces(previousPlaces);
      setSchedule(previousSchedule);
      setStays(previousStays);
      showTimelineError(error);
    }
  }

  async function addPlaceToLocation(place: SavedPlace, location: LocationSegment) {
    const previousPlaces = places;
    const savedPlace = await savePlace(place);
    if (savedPlace.locationSegmentIds?.includes(location.id)) return;
    setPlaces(current =>
      current.map(item =>
        item.id === savedPlace.id
          ? { ...item, locationSegmentIds: [...(item.locationSegmentIds ?? []), location.id] }
          : item,
      ),
    );
    if (!initialTrip) return;
    try {
      await requestJson(`/api/trips/${initialTrip.id}/location-segments/${location.id}/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedPlaceId: savedPlace.id }),
      });
    } catch (error) {
      setPlaces(previousPlaces);
      showTimelineError(error);
    }
  }

  async function removePlaceFromLocation(place: SavedPlace, location: LocationSegment) {
    const previousPlaces = places;
    setPlaces(current =>
      current.map(item =>
        item.id === place.id
          ? {
              ...item,
              locationSegmentIds: (item.locationSegmentIds ?? []).filter(id => id !== location.id),
            }
          : item,
      ),
    );
    if (!initialTrip) return;
    try {
      await requestJson(`/api/trips/${initialTrip.id}/location-segments/${location.id}/places`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedPlaceId: place.id }),
      });
    } catch (error) {
      setPlaces(previousPlaces);
      showTimelineError(error);
    }
  }

  async function addToDay(place: SavedPlace, date = selectedDate, preserveWorkspaceView = false) {
    if (!date) return;
    let savedPlace: SavedPlace;
    try {
      savedPlace = await savePlace(place);
    } catch (error) {
      showTimelineError(error);
      return;
    }
    const alreadyScheduled = schedule.some(
      item => item.date === date && item.savedPlaceId === savedPlace.id,
    );
    const nextTime = alreadyScheduled
      ? '20:00'
      : date === selectedDate && selectedSchedule.length
        ? '14:00'
        : '10:00';
    const optimisticId = `schedule-${savedPlace.id}-${Date.now()}`;
    const optimisticItem: ScheduleItem = {
      id: optimisticId,
      savedPlaceId: savedPlace.id,
      date,
      startTime: nextTime,
      duration: 60,
    };
    setSchedule(items => [...items, optimisticItem]);
    setSelectedDate(date);
    setPreviewPlace(null);
    if (!preserveWorkspaceView) setMode('day');

    if (!initialTrip) return;
    try {
      const body = await requestJson<{ schedule: ScheduleItem }>(
        `/api/trips/${initialTrip.id}/schedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            savedPlaceId: savedPlace.id,
            date,
            startTime: nextTime,
            duration: 60,
          }),
        },
      );
      setSchedule(items => items.map(item => (item.id === optimisticId ? body.schedule : item)));
    } catch (error) {
      setSchedule(items => items.filter(item => item.id !== optimisticId));
      showTimelineError(error);
    }
  }

  async function addManualActivity(draft: ActivityDraft) {
    if (!selectedDate || !initialTrip) return;
    const optimisticId = `activity-${crypto.randomUUID()}`;
    const optimisticItem: ScheduleItem = {
      id: optimisticId,
      savedPlaceId: null,
      date: selectedDate,
      startTime: draft.startTime,
      duration: draft.duration,
      note: draft.note || undefined,
      title: draft.name,
      category: draft.category,
      amount: draft.amount ?? undefined,
      currency: draft.amount == null ? undefined : draft.currency,
    };
    setSchedule(items => [...items, optimisticItem]);
    setMode('day');

    try {
      const body = await requestJson<{
        schedule: ScheduleItem;
      }>(`/api/trips/${initialTrip.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          startTime: draft.startTime,
          duration: draft.duration,
          title: draft.name,
          category: draft.category,
          note: draft.note || undefined,
          amount: draft.amount,
          currency: draft.amount == null ? undefined : draft.currency,
        }),
      });
      setSchedule(items => items.map(item => (item.id === optimisticId ? body.schedule : item)));
    } catch (error) {
      setSchedule(items => items.filter(item => item.id !== optimisticId));
      showTimelineError(error);
    }
  }

  async function importGoogleList(url: string) {
    if (!initialTrip) throw new Error('Create a trip before importing places.');
    const result = await requestJson<{
      places: SavedPlace[];
      listName?: string;
      importedCount: number;
      skippedCount: number;
    }>(`/api/trips/${initialTrip.id}/places/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    setPlaces(current => {
      const existingIds = new Set(current.map(place => place.id));
      return [...current, ...result.places.filter(place => !existingIds.has(place.id))];
    });
    return {
      listName: result.listName,
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
    };
  }

  async function removeFromSchedule(itemId: string) {
    const item = schedule.find(candidate => candidate.id === itemId);
    if (!item) return;

    const previousSchedule = schedule;
    setSchedule(items => items.filter(candidate => candidate.id !== itemId));
    if (!initialTrip || itemId.startsWith('schedule-') || itemId.startsWith('activity-')) return;

    try {
      await requestJson<{ deleted: string }>(`/api/trips/${initialTrip.id}/schedule/${itemId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      setSchedule(previousSchedule);
      showTimelineError(error);
    }
  }

  function showTimelineError(error: unknown) {
    setTimelineError(
      error instanceof Error ? error.message : 'Could not save this timeline change.',
    );
    window.setTimeout(() => setTimelineError(null), 4500);
  }

  function formatRequestError(error: unknown) {
    if (typeof error === 'string' && error.trim()) return error;
    if (!error || typeof error !== 'object') return 'Could not save this change.';

    const payload = error as {
      message?: unknown;
      formErrors?: unknown;
      fieldErrors?: unknown;
    };
    const messages: string[] = [];
    if (typeof payload.message === 'string') messages.push(payload.message);
    if (Array.isArray(payload.formErrors)) {
      messages.push(
        ...payload.formErrors.filter((value): value is string => typeof value === 'string'),
      );
    }
    if (payload.fieldErrors && typeof payload.fieldErrors === 'object') {
      Object.values(payload.fieldErrors).forEach(value => {
        if (Array.isArray(value)) {
          messages.push(...value.filter((item): item is string => typeof item === 'string'));
        }
      });
    }
    return messages.join(' ') || 'Could not save this change.';
  }

  async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => ({}))) as { error?: unknown } & T;
    if (!response.ok) throw new Error(formatRequestError(body.error));
    return body;
  }

  function locationFromApi(row: {
    id: string;
    trip_id: string;
    location_name: string;
    country: string | null;
    area: string | null;
    latitude: number | null;
    longitude: number | null;
    start_date: string;
    end_date: string;
  }): LocationSegment {
    return {
      id: row.id,
      tripId: row.trip_id,
      locationName: row.location_name,
      country: row.country ?? undefined,
      area: row.area ?? undefined,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      startDate: row.start_date,
      endDate: row.end_date,
    };
  }

  function stayFromApi(row: {
    id: string;
    trip_id: string;
    name: string;
    saved_place_id: string | null;
    address: string | null;
    location_label: string | null;
    price: string | null;
    price_amount: number | string | null;
    price_currency: string | null;
    cancellation_time: string | null;
    check_in_date: string;
    check_out_date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    confirmation_number: string | null;
    secret_code: string | null;
    notes: string | null;
  }): Stay {
    return {
      id: row.id,
      tripId: row.trip_id,
      name: row.name,
      savedPlaceId: row.saved_place_id,
      address: row.address ?? undefined,
      locationLabel: row.location_label ?? undefined,
      price: row.price ?? undefined,
      priceAmount: row.price_amount == null ? undefined : Number(row.price_amount),
      priceCurrency: row.price_currency ?? undefined,
      cancellationTime: row.cancellation_time ?? undefined,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      checkInTime: row.check_in_time ?? undefined,
      checkOutTime: row.check_out_time ?? undefined,
      confirmationNumber: row.confirmation_number ?? undefined,
      secretCode: row.secret_code ?? undefined,
      notes: row.notes ?? undefined,
    };
  }

  async function addLocation(sourceSegmentId: string, splitDate: string, draft: LocationDraft) {
    if (!initialTrip) return;
    const previous = locationSegments;
    const source = previous.find(segment => segment.id === sourceSegmentId);
    if (!source) return;
    const optimistic: LocationSegment = {
      id: `location-${crypto.randomUUID()}`,
      tripId: initialTrip.id,
      locationName: draft.locationName,
      startDate: splitDate,
      endDate: source.endDate,
    };
    setLocationSegments(
      [
        ...previous.map(segment =>
          segment.id === source.id ? { ...segment, endDate: splitDate } : segment,
        ),
        optimistic,
      ].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    );
    try {
      const body = await requestJson<{ segments: Parameters<typeof locationFromApi>[0][] }>(
        `/api/trips/${initialTrip.id}/location-segments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceSegmentId,
            splitDate,
            locationName: draft.locationName,
          }),
        },
      );
      setLocationSegments(body.segments.map(locationFromApi));
    } catch (error) {
      setLocationSegments(previous);
      showTimelineError(error);
      throw error;
    }
  }

  async function createLocationDivision(startDate: string, endDate: string, draft: LocationDraft) {
    if (!initialTrip) return;
    const previous = locationSegments;
    const optimistic: LocationSegment = {
      id: `location-${crypto.randomUUID()}`,
      tripId: initialTrip.id,
      locationName: draft.locationName,
      startDate,
      endDate,
    };
    let inserted = false;
    const nextSegments: LocationSegment[] = [];
    for (const segment of previous) {
      if (segment.endDate <= startDate || segment.startDate >= endDate) {
        nextSegments.push(segment);
        continue;
      }
      const hasBefore = segment.startDate < startDate;
      if (hasBefore) nextSegments.push({ ...segment, endDate: startDate });
      if (!inserted) {
        nextSegments.push(optimistic);
        inserted = true;
      }
      if (segment.endDate > endDate) {
        nextSegments.push({
          ...segment,
          id: hasBefore ? `location-${crypto.randomUUID()}` : segment.id,
          startDate: endDate,
        });
      }
    }
    if (!inserted) nextSegments.push(optimistic);
    setLocationSegments(nextSegments.sort((a, b) => a.startDate.localeCompare(b.startDate)));
    try {
      const body = await requestJson<{ segments: Parameters<typeof locationFromApi>[0][] }>(
        `/api/trips/${initialTrip.id}/location-segments/division`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate,
            endDate,
            locationName: draft.locationName,
          }),
        },
      );
      setLocationSegments(body.segments.map(locationFromApi));
    } catch (error) {
      setLocationSegments(previous);
      showTimelineError(error);
      throw error;
    }
  }

  async function updateLocation(segmentId: string, draft: LocationDraft) {
    if (!initialTrip) return;
    const previous = locationSegments;
    setLocationSegments(current =>
      current.map(segment =>
        segment.id === segmentId
          ? {
              ...segment,
              locationName: draft.locationName,
              startDate: draft.startDate ?? segment.startDate,
              endDate: draft.endDate ?? segment.endDate,
            }
          : segment,
      ),
    );
    try {
      const body = await requestJson<{ segment: Parameters<typeof locationFromApi>[0] }>(
        `/api/trips/${initialTrip.id}/location-segments/${segmentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationName: draft.locationName,
            ...(draft.startDate === undefined ? {} : { startDate: draft.startDate }),
            ...(draft.endDate === undefined ? {} : { endDate: draft.endDate }),
          }),
        },
      );
      setLocationSegments(current =>
        current.map(segment =>
          segment.id === segmentId ? locationFromApi(body.segment) : segment,
        ),
      );
    } catch (error) {
      setLocationSegments(previous);
      showTimelineError(error);
      throw error;
    }
  }

  async function deleteLocation(segmentId: string, neighborSegmentId?: string) {
    if (!initialTrip) return;
    const previous = locationSegments;
    const segment = previous.find(item => item.id === segmentId);
    const neighbor = neighborSegmentId
      ? previous.find(item => item.id === neighborSegmentId)
      : undefined;
    if (!segment || (neighborSegmentId && !neighbor)) return;
    const merged = neighbor
      ? neighbor.endDate === segment.startDate
        ? { ...neighbor, endDate: segment.endDate }
        : { ...neighbor, startDate: segment.startDate }
      : null;
    setLocationSegments(current => {
      const withoutSegment = current.filter(item => item.id !== segmentId);
      return merged
        ? withoutSegment.map(item => (item.id === neighborSegmentId ? merged : item))
        : withoutSegment;
    });
    try {
      const body = await requestJson<{ segments: Parameters<typeof locationFromApi>[0][] }>(
        `/api/trips/${initialTrip.id}/location-segments/${segmentId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(neighborSegmentId ? { neighborSegmentId } : {}),
        },
      );
      setLocationSegments(body.segments.map(locationFromApi));
    } catch (error) {
      setLocationSegments(previous);
      showTimelineError(error);
    }
  }

  async function moveBoundary(leftSegmentId: string, rightSegmentId: string, newBoundary: string) {
    if (!initialTrip) return;
    const previous = locationSegments;
    setLocationSegments(current =>
      current.map(segment =>
        segment.id === leftSegmentId
          ? { ...segment, endDate: newBoundary }
          : segment.id === rightSegmentId
            ? { ...segment, startDate: newBoundary }
            : segment,
      ),
    );
    try {
      const body = await requestJson<{ segments: Parameters<typeof locationFromApi>[0][] }>(
        `/api/trips/${initialTrip.id}/location-segments/boundary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leftSegmentId, rightSegmentId, newBoundary }),
        },
      );
      setLocationSegments(body.segments.map(locationFromApi));
    } catch (error) {
      setLocationSegments(previous);
      showTimelineError(error);
    }
  }

  async function moveSharedTimelineBoundary(
    leftSegmentId: string,
    rightSegmentId: string,
    stayId: string,
    newBoundary: string,
  ) {
    if (!initialTrip) return;
    const previousLocations = locationSegments;
    const previousStays = stays;
    setLocationSegments(current =>
      current.map(segment =>
        segment.id === leftSegmentId
          ? { ...segment, endDate: newBoundary }
          : segment.id === rightSegmentId
            ? { ...segment, startDate: newBoundary }
            : segment,
      ),
    );
    setStays(current =>
      current.map(stay => (stay.id === stayId ? { ...stay, checkOutDate: newBoundary } : stay)),
    );
    try {
      const body = await requestJson<{
        segments: Parameters<typeof locationFromApi>[0][];
        stay: Parameters<typeof stayFromApi>[0];
      }>(`/api/trips/${initialTrip.id}/timeline/shared-boundary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftSegmentId, rightSegmentId, stayId, newBoundary }),
      });
      setLocationSegments(body.segments.map(locationFromApi));
      setStays(current =>
        current.map(stay => (stay.id === stayId ? stayFromApi(body.stay) : stay)),
      );
    } catch (error) {
      setLocationSegments(previousLocations);
      setStays(previousStays);
      showTimelineError(error);
    }
  }

  async function createStay(draft: StayDraft) {
    if (!initialTrip) return;
    const previous = stays;
    const optimistic: Stay = {
      id: `stay-${crypto.randomUUID()}`,
      tripId: initialTrip.id,
      name: draft.name,
      savedPlaceId: draft.savedPlaceId,
      address: draft.address || undefined,
      locationLabel: draft.locationLabel || undefined,
      price: draft.price || undefined,
      priceAmount: parseAmount(draft.price) ?? undefined,
      priceCurrency: parseAmount(draft.price) == null ? undefined : draft.priceCurrency,
      cancellationTime: draft.cancellationTime || undefined,
      checkInDate: draft.checkInDate,
      checkOutDate: draft.checkOutDate,
      confirmationNumber: draft.confirmationNumber || undefined,
      secretCode: draft.secretCode || undefined,
      notes: draft.notes || undefined,
    };
    setStays(current =>
      [...current, optimistic].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate)),
    );
    try {
      const body = await requestJson<{
        stay: Parameters<typeof stayFromApi>[0];
        expense?: Parameters<typeof expenseFromDatabase>[0] | null;
      }>(`/api/trips/${initialTrip.id}/stays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          priceAmount: parseAmount(draft.price),
          priceCurrency: parseAmount(draft.price) == null ? undefined : draft.priceCurrency,
        }),
      });
      setStays(current =>
        [...current.filter(stay => stay.id !== optimistic.id), stayFromApi(body.stay)].sort(
          (a, b) => a.checkInDate.localeCompare(b.checkInDate),
        ),
      );
      if (body.expense) updateExpenses([...expenses, expenseFromDatabase(body.expense)]);
    } catch (error) {
      setStays(previous);
      showTimelineError(error);
      throw error;
    }
  }

  async function updateStay(stayId: string, draft: StayDraft) {
    if (!initialTrip) return;
    const previous = stays;
    setStays(current =>
      current
        .map(stay =>
          stay.id === stayId
            ? {
                ...stay,
                name: draft.name,
                savedPlaceId: draft.savedPlaceId,
                address: draft.address || undefined,
                locationLabel: draft.locationLabel || undefined,
                price: draft.price || undefined,
                priceAmount: parseAmount(draft.price) ?? undefined,
                priceCurrency: parseAmount(draft.price) == null ? undefined : draft.priceCurrency,
                cancellationTime: draft.cancellationTime || undefined,
                checkInDate: draft.checkInDate,
                checkOutDate: draft.checkOutDate,
                confirmationNumber: draft.confirmationNumber || undefined,
                secretCode: draft.secretCode || undefined,
                notes: draft.notes || undefined,
              }
            : stay,
        )
        .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate)),
    );
    try {
      const body = await requestJson<{
        stay: Parameters<typeof stayFromApi>[0];
        expense?: Parameters<typeof expenseFromDatabase>[0] | null;
      }>(`/api/trips/${initialTrip.id}/stays/${stayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          priceAmount: parseAmount(draft.price),
          priceCurrency: parseAmount(draft.price) == null ? undefined : draft.priceCurrency,
        }),
      });
      setStays(current =>
        current
          .map(stay => (stay.id === stayId ? stayFromApi(body.stay) : stay))
          .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate)),
      );
      if (body.expense) {
        const updatedExpense = expenseFromDatabase(body.expense);
        updateExpenses(
          expenses.map(expense => (expense.id === updatedExpense.id ? updatedExpense : expense)),
        );
      }
    } catch (error) {
      setStays(previous);
      showTimelineError(error);
      throw error;
    }
  }

  async function moveStayDates(stayId: string, checkInDate: string, checkOutDate: string) {
    if (!initialTrip) return;
    const previous = stays;
    setStays(current =>
      current
        .map(stay => (stay.id === stayId ? { ...stay, checkInDate, checkOutDate } : stay))
        .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate)),
    );
    try {
      const body = await requestJson<{ stay: Parameters<typeof stayFromApi>[0] }>(
        `/api/trips/${initialTrip.id}/stays/${stayId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkInDate, checkOutDate }),
        },
      );
      setStays(current =>
        current
          .map(stay => (stay.id === stayId ? stayFromApi(body.stay) : stay))
          .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate)),
      );
    } catch (error) {
      setStays(previous);
      showTimelineError(error);
    }
  }

  async function deleteStay(stayId: string) {
    if (!initialTrip) return;
    const previous = stays;
    const previousExpenses = expenses;
    setStays(current => current.filter(stay => stay.id !== stayId));
    updateExpenses(expenses.filter(expense => expense.stayId !== stayId));
    try {
      await requestJson<{ deleted: string }>(`/api/trips/${initialTrip.id}/stays/${stayId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      setStays(previous);
      updateExpenses(previousExpenses);
      showTimelineError(error);
    }
  }

  function updateFlights(nextFlights: TripFlight[]) {
    setFlights(nextFlights);
    setTrip(current =>
      current
        ? { ...current, flights: nextFlights }
        : currentTrip
          ? { ...currentTrip, flights: nextFlights }
          : current,
    );
  }

  function updateExpenses(nextExpenses: Expense[]) {
    setExpenses(nextExpenses);
    setTrip(current =>
      current
        ? { ...current, expenses: nextExpenses }
        : currentTrip
          ? { ...currentTrip, expenses: nextExpenses }
          : current,
    );
  }

  function updateLinkedStayPrice(stayId: string, amount: number, currency: string) {
    setStays(current =>
      current.map(stay =>
        stay.id === stayId
          ? { ...stay, price: String(amount), priceAmount: amount, priceCurrency: currency }
          : stay,
      ),
    );
  }

  async function saveDayNotes(notes: string) {
    if (!initialTrip || !selectedDay) return;
    const previousNotes = selectedDay.notes;
    setTrip(current =>
      current
        ? {
            ...current,
            days: current.days.map(day =>
              day.id === selectedDay.id ? { ...day, notes: notes || undefined } : day,
            ),
          }
        : current,
    );
    try {
      const body = await requestJson<{ day: { id: string; notes: string | null } }>(
        `/api/trips/${initialTrip.id}/days/${selectedDay.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: notes || null }),
        },
      );
      setTrip(current =>
        current
          ? {
              ...current,
              days: current.days.map(day =>
                day.id === body.day.id ? { ...day, notes: body.day.notes ?? undefined } : day,
              ),
            }
          : current,
      );
    } catch (error) {
      setTrip(current =>
        current
          ? {
              ...current,
              days: current.days.map(day =>
                day.id === selectedDay.id ? { ...day, notes: previousNotes } : day,
              ),
            }
          : current,
      );
      showTimelineError(error);
      throw error;
    }
  }

  function moveScheduleItem(item: ScheduleItem, direction: 'up' | 'down') {
    const items = schedule
      .filter(candidate => candidate.date === item.date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const index = items.findIndex(candidate => candidate.id === item.id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= items.length) return;
    const swapped = [...items];
    [swapped[index].startTime, swapped[target].startTime] = [
      swapped[target].startTime,
      swapped[index].startTime,
    ];
    setSchedule(current =>
      current.map(candidate => swapped.find(next => next.id === candidate.id) ?? candidate),
    );
  }

  async function moveScheduleItemToDate(itemId: string, date: string) {
    const item = schedule.find(candidate => candidate.id === itemId);
    if (!item || item.date === date) return;
    const previousSchedule = schedule;
    setSchedule(current =>
      current.map(candidate => (candidate.id === itemId ? { ...candidate, date } : candidate)),
    );
    if (!initialTrip) return;

    try {
      const body = await requestJson<{ schedule: ScheduleItem }>(
        `/api/trips/${initialTrip.id}/schedule/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, startTime: item.startTime }),
        },
      );
      setSchedule(current =>
        current.map(candidate => (candidate.id === itemId ? body.schedule : candidate)),
      );
    } catch (error) {
      setSchedule(previousSchedule);
      showTimelineError(error);
    }
  }

  function selectTimelineDay(date: string) {
    setSelectedDate(date);
    setSelectedPlaceId(null);
    setPreviewPlace(null);
    setShowDayPlanOnly(true);
  }

  function selectTimelinePlace(place: SavedPlace) {
    setSelectedPlaceId(place.id);
  }

  function addActivityForDate(date: string) {
    setSelectedDate(date);
    setActivityEditorOpen('activity');
  }

  function openDayNotesForDate(date: string) {
    setSelectedDate(date);
    setDayNotesOpen(true);
  }

  function openTripSettings(flightDate?: string) {
    setSettingsFlightDate(flightDate);
    setSettingsOpen(true);
  }

  function changeMode(nextMode: EditorMode) {
    if (!currentTrip) return;
    const editorHref = tripBackHref ?? `/editor?trip=${encodeURIComponent(currentTrip.id)}`;
    if (nextMode === 'expenses') {
      if (pathname === '/expenses') setMode('expenses');
      else router.push(`/expenses?trip=${encodeURIComponent(currentTrip.id)}`);
      return;
    }
    if (pathname === '/expenses') {
      router.push(editorHref);
      return;
    }
    setMode(nextMode);
  }

  function closeTripSettings() {
    setSettingsOpen(false);
    setSettingsFlightDate(undefined);
  }

  return (
    <main className={styles.app} ref={editorRef} data-day-panel={selectedDate ? 'open' : 'closed'}>
      {!currentTrip ? (
        <AddTripFlow
          preferences={user.preferences}
        />
      ) : (
        <>
          {mode !== 'expenses' && (
            <DateBar
              days={days}
              selectedDate={selectedDate}
              selectedLocationId={selectedLocationId}
              schedule={schedule}
              locationSegments={locationSegments}
              stays={stays}
              places={places}
              destinationLabel={currentTrip.destinationLabel ?? currentTrip.name}
              defaultCurrency={user.preferences.currency}
              onSavePlace={savePlace}
              onSelectDay={selectDay}
              onSelectLocation={selectLocation}
              onAddPlaceToLocation={addPlaceToLocation}
              onMoveActivity={moveScheduleItemToDate}
              onAddPlaceToDay={(place, date) => void addToDay(place, date, true)}
              onAddLocation={addLocation}
              onCreateLocationDivision={createLocationDivision}
              onUpdateLocation={updateLocation}
              onDeleteLocation={deleteLocation}
              onMoveBoundary={moveBoundary}
              onMoveSharedBoundary={moveSharedTimelineBoundary}
              onCreateStay={createStay}
              onUpdateStay={updateStay}
              onMoveStayDates={moveStayDates}
              onDeleteStay={deleteStay}
            />
          )}
          {timelineError && (
            <div className={styles.timelineError} role="status">
              {timelineError}
            </div>
          )}
          <div
            className={`${styles.workspace} ${workspaceView === 'timeline' ? styles.workspaceTimeline : ''}`}
          >
            <PlaceHoverProvider>
              {mode === 'expenses' ? (
                <ExpensesPanel
                  tripId={currentTrip.id}
                  tripStartDate={currentTrip.startDate}
                  tripEndDate={currentTrip.endDate}
                  defaultCurrency={user.preferences.currency}
                  expenses={expenses}
                  stays={stays}
                  flights={flights}
                  schedule={schedule}
                  places={places}
                  days={days}
                  onExpensesChange={updateExpenses}
                  onLinkedStayPriceChange={updateLinkedStayPrice}
                />
              ) : workspaceView === 'timeline' ? (
                <TimelineView
                  days={days}
                  schedule={schedule}
                  flights={flights}
                  places={places}
                  selectedDate={selectedDate}
                  selectedPlaceId={selectedPlaceId}
                  destinationLabel={currentTrip.destinationLabel ?? currentTrip.name}
                  onSelectDay={selectTimelineDay}
                  onSelectPlace={selectTimelinePlace}
                  onMoveActivity={moveScheduleItemToDate}
                  onRemoveActivity={removeFromSchedule}
                  onAddPlaceToDay={(place, date) => void addToDay(place, date, true)}
                  onAddActivity={addActivityForDate}
                  onOpenDayNotes={openDayNotesForDate}
                />
              ) : (
                <>
                  {activeLocation ? (
                    <LocationPlanPanel
                      mode={mode}
                      location={activeLocation}
                      places={places}
                      selectedPlaceId={selectedPlaceId}
                      onSelectPlace={selectPlace}
                      onAddPlace={addPlaceToLocation}
                      onRemovePlace={removePlaceFromLocation}
                      onClose={() => setMode('map')}
                    />
                  ) : (
                    <DayPlanPanel
                      mode={mode}
                      selectedDay={selectedDay}
                      isFirstDay={selectedDate === days[0]?.date}
                      isLastDay={selectedDate === days[days.length - 1]?.date}
                      selectedSchedule={selectedSchedule}
                      selectedFlights={selectedFlights}
                      stays={stays}
                      destinationLabel={currentTrip.destinationLabel ?? currentTrip.name}
                      places={places}
                      selectedPlaceId={selectedPlaceId}
                      onSelectPlace={selectPlace}
                      onClose={() => setMode('map')}
                      onMove={moveScheduleItem}
                      onRemove={removeFromSchedule}
                      onOpenActivityEditor={() => setActivityEditorOpen('activity')}
                      onOpenTravelDetails={() => openTripSettings(selectedDate)}
                      hasArrivalFlight={hasArrivalFlight}
                      hasDepartureFlight={hasDepartureFlight}
                      onOpenDayNotes={() => setDayNotesOpen(true)}
                    />
                  )}
                  <MapPanel
                    mode={mode}
                    destinationLabel={currentTrip.destinationLabel ?? currentTrip.name}
                    places={places}
                    schedule={schedule}
                    locationSegments={locationSegments}
                    activeLocation={activeLocation}
                    tripStartDate={currentTrip.startDate}
                    tripEndDate={currentTrip.endDate}
                    selectedDate={selectedDate}
                    stays={stays}
                    flights={flights}
                    selectedPlaceId={selectedPlaceId}
                    previewPlace={previewPlace}
                    showDayPlanOnly={showDayPlanOnly}
                    selectedDayLabel={selectedDay?.weekday.toLowerCase() ?? 'your day'}
                    onSelectPlace={selectPlace}
                    onShowDayPlanOnlyChange={setShowDayPlanOnly}
                    onVisibleMapPlacesChange={setVisibleMapPlaceIds}
                    onClosePreview={() => setPreviewPlace(null)}
                    onSavePlace={savePlace}
                    onToggleFavorite={toggleFavorite}
                    onSaveComment={savePlaceComment}
                    onAddToDay={addToDay}
                  />
                </>
              )}
              {mode !== 'expenses' && (
                <PlacesPanel
                  mode={mode}
                  places={places}
                  filteredPlaces={filteredPlaces}
                  locationCandidatePlaces={filteredPlaces}
                  activeLocation={null}
                  locationPlaces={[]}
                  schedule={schedule}
                  filter={filter}
                  selectedPlaceId={selectedPlaceId}
                  selectedDay={selectedDay}
                  libraryQuery={libraryQuery}
                  showOnlyVisiblePlaces={showOnlyVisiblePlaces}
                  onFilterChange={setFilter}
                  onQueryChange={setLibraryQuery}
                  onShowOnlyVisiblePlacesChange={setShowOnlyVisiblePlaces}
                  onSelectPlace={selectPlace}
                  onAddToDay={addToDay}
                  onAddToLocation={addPlaceToLocation}
                  onRemoveFromLocation={removePlaceFromLocation}
                  onToggleFavorite={toggleFavorite}
                  onDeletePlace={deletePlace}
                  onImportGoogleList={importGoogleList}
                />
              )}
            </PlaceHoverProvider>
          </div>
        </>
      )}
      {currentTrip && settingsOpen && (
        <TripSettingsModal
          key={`${currentTrip.id}-${currentTrip.startDate}-${currentTrip.endDate}-${settingsFlightDate ?? ''}`}
          open
          trip={currentTrip}
          initialFlightDate={settingsFlightDate}
          focusFlights={Boolean(settingsFlightDate)}
          onClose={closeTripSettings}
          onSaved={updatedTrip => {
            setTrip(current => ({ ...(current ?? currentTrip), ...updatedTrip, flights }));
            setSelectedDate(currentDate =>
              updatedTrip.days.some(day => day.date === currentDate)
                ? currentDate
                : (updatedTrip.days[0]?.date ?? ''),
            );
          }}
          onDeleted={() => {
            closeTripSettings();
            router.replace('/editor');
          }}
          onFlightsChange={updateFlights}
          onExpensesChange={updateExpenses}
        />
      )}
      {currentTrip && selectedDay && dayNotesOpen && (
        <DayNotesEditor
          key={selectedDay.id}
          open
          dayLabel={selectedDay.label}
          shortDate={selectedDay.shortDate}
          initialNotes={selectedDay.notes ?? ''}
          onClose={() => setDayNotesOpen(false)}
          onSave={saveDayNotes}
        />
      )}
      {currentTrip && selectedDay && activityEditorOpen && (
        <ActivityEditor
          key={`${selectedDay.date}-${activityEditorOpen}`}
          open
          dayLabel={selectedDay.label}
          shortDate={selectedDay.shortDate}
          initialTime={
            activityEditorOpen === 'arrival'
              ? '09:00'
              : activityEditorOpen === 'departure'
                ? '18:00'
                : selectedSchedule.length
                  ? '14:00'
                  : '10:00'
          }
          initialCategory={activityEditorOpen === 'activity' ? 'CUSTOM' : 'TRANSPORT'}
          defaultCurrency={user.preferences.currency}
          title={
            activityEditorOpen === 'arrival'
              ? 'Add arrival details'
              : activityEditorOpen === 'departure'
                ? 'Add departure details'
                : 'Add an activity'
          }
          nameLabel={
            activityEditorOpen === 'arrival'
              ? 'How are you arriving?'
              : activityEditorOpen === 'departure'
                ? 'How are you leaving?'
                : undefined
          }
          namePlaceholder={
            activityEditorOpen === 'arrival'
              ? 'Flight, train from home, airport transfer…'
              : activityEditorOpen === 'departure'
                ? 'Flight, train home, airport transfer…'
                : undefined
          }
          onClose={() => setActivityEditorOpen(null)}
          onSave={draft => {
            addManualActivity(draft);
            setActivityEditorOpen(null);
          }}
        />
      )}
      {accountOpen && (
        <UserModal
          open
          user={user}
          onClose={() => setAccountOpen(false)}
          onThemeChange={updateTheme}
        />
      )}
    </main>
  );
}
