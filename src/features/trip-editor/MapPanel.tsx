'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MapPinPlus, Search, Star, X } from 'lucide-react';
import styles from './MapPanel.module.scss';
import { GoogleMapCanvas } from './GoogleMapCanvas';
import { usePlaceHover } from './PlaceHoverContext';
import type {
  EditorMode,
  LocationSegment,
  SavedPlace,
  ScheduleItem,
  Stay,
  TripFlight,
} from './types';
import { useClickOutside } from './use-click-outside';

type MapPanelProps = {
  mode: EditorMode;
  destinationLabel?: string | null;
  places: SavedPlace[];
  schedule: ScheduleItem[];
  locationSegments: LocationSegment[];
  activeLocation: LocationSegment | null;
  tripStartDate: string;
  tripEndDate: string;
  selectedDate: string;
  stays: Stay[];
  flights: TripFlight[];
  selectedPlaceId: string | null;
  previewPlace: SavedPlace | null;
  showDayPlanOnly: boolean;
  selectedDayLabel: string;
  onSelectPlace: (place: SavedPlace) => void;
  onShowDayPlanOnlyChange: (value: boolean) => void;
  onVisibleMapPlacesChange: (placeIds: string[]) => void;
  onClosePreview: () => void;
  onSavePlace: (place: SavedPlace) => Promise<SavedPlace>;
  onToggleFavorite: (place: SavedPlace) => Promise<void> | void;
  onSaveComment: (place: SavedPlace, comment: string) => Promise<SavedPlace>;
  onAddToDay: (place: SavedPlace) => void;
};

type MappableLocationSegment = LocationSegment & {
  latitude: number;
  longitude: number;
};

function hasMapCoordinates(segment: LocationSegment): segment is MappableLocationSegment {
  return typeof segment.latitude === 'number' && typeof segment.longitude === 'number';
}

function locationPlaceFromSegment(segment: MappableLocationSegment): SavedPlace {
  const details = [segment.area, segment.country].filter(Boolean).join(' · ');
  return {
    id: `location-segment:${segment.id}`,
    name: segment.locationName,
    subtitle: details || 'Trip location',
    category: 'CUSTOM',
    emoji: '⌖',
    color: '#8e9992',
    lat: segment.latitude,
    lng: segment.longitude,
    provider: 'CUSTOM',
  };
}

type AirportRouteLocation = {
  id: string;
  name: string;
  subtitle: string;
  query: string;
  phase: 'arrival' | 'departure';
};

function airportRouteLocation(
  phase: AirportRouteLocation['phase'],
  name: string | undefined,
  iata: string | undefined,
  icao: string | undefined,
): AirportRouteLocation | null {
  const code = iata ?? icao;
  const label = name ?? code;
  if (!label) return null;
  const identifier = (code ?? name ?? '').trim().toLowerCase();
  if (!identifier) return null;

  return {
    id: `flight-airport:${identifier}`,
    name: label,
    subtitle: `${code ? `${code} · ` : ''}Airport`,
    query: [name, code, 'airport'].filter((value): value is string => Boolean(value)).join(' '),
    phase,
  };
}

function airportPlaceFromSearch(airport: AirportRouteLocation, place: SavedPlace): SavedPlace {
  return {
    ...place,
    id: airport.id,
    name: airport.name,
    subtitle: airport.subtitle,
    category: 'TRANSPORT',
    emoji: '✈',
    color: '#477d67',
  };
}

type PlaceCommentFormProps = {
  place: SavedPlace;
  savedPlace: SavedPlace | undefined;
  onSaveComment: (place: SavedPlace, comment: string) => Promise<SavedPlace>;
  onError: (message: string) => void;
};

function PlaceCommentForm({ place, savedPlace, onSaveComment, onError }: PlaceCommentFormProps) {
  const savedComment = savedPlace?.comment ?? '';
  const [comment, setComment] = useState(savedComment);
  const [savingComment, setSavingComment] = useState(false);

  async function saveComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (comment === savedComment) return;
    setSavingComment(true);
    onError('');
    try {
      await onSaveComment(place, comment);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save this comment.');
    } finally {
      setSavingComment(false);
    }
  }

  return (
    <form className={styles.previewComment} onSubmit={event => void saveComment(event)}>
      <label htmlFor={`place-comment-${place.id}`}>Comment</label>
      <textarea
        id={`place-comment-${place.id}`}
        value={comment}
        onChange={event => setComment(event.target.value)}
        placeholder="Add a note for your trip"
        maxLength={5000}
        rows={2}
        style={{
          fontSize: 12,
          resize: 'none',
        }}
      />
      <button type="submit" disabled={savingComment || comment === savedComment}>
        {savingComment ? 'Saving…' : savedPlace ? 'Save comment' : 'Add pin & comment'}
      </button>
    </form>
  );
}

export function MapPanel({
  mode,
  destinationLabel,
  places,
  schedule,
  locationSegments,
  activeLocation,
  tripStartDate,
  tripEndDate,
  selectedDate,
  stays,
  flights,
  selectedPlaceId,
  previewPlace,
  showDayPlanOnly,
  selectedDayLabel,
  onSelectPlace,
  onShowDayPlanOnlyChange,
  onVisibleMapPlacesChange,
  onClosePreview,
  onSavePlace,
  onToggleFavorite,
  onSaveComment,
  onAddToDay,
}: MapPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SavedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [placeActionError, setPlaceActionError] = useState('');
  const [loadingPlaceId, setLoadingPlaceId] = useState<string | null>(null);
  const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);
  const [favoritingPlaceId, setFavoritingPlaceId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [previewPhotoSelection, setPreviewPhotoSelection] = useState<{
    placeId: string;
    index: number;
  } | null>(null);
  const [airportPlaces, setAirportPlaces] = useState<Record<string, SavedPlace>>({});
  const { hoveredPlaceId } = usePlaceHover();
  const mapSearchRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const airportLookupsInFlight = useRef(new Set<string>());

  useClickOutside(mapSearchRef, () => setSearchOpen(false), searchOpen);
  useClickOutside(previewRef, onClosePreview, Boolean(previewPlace));

  const localResults = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];
    return places
      .filter(
        (place, index, all) => all.findIndex(candidate => candidate.id === place.id) === index,
      )
      .filter(place => `${place.name} ${place.subtitle}`.toLowerCase().includes(normalized))
      .slice(0, 4);
  }, [places, query]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const params = new URLSearchParams({ query: normalized });
        if (destinationLabel?.trim()) params.set('destination', destinationLabel.trim());
        const response = await fetch(`/api/places?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { places?: SavedPlace[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Place search failed');
        const remote = payload.places ?? [];
        setResults(
          [...remote, ...localResults]
            .filter(
              (place, index, all) =>
                all.findIndex(candidate => candidate.id === place.id) === index,
            )
            .slice(0, 6),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setResults(localResults);
        setSearchError('Showing saved suggestions while Google Places is unavailable.');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [destinationLabel, localResults, query]);

  const selectedDaySchedule = useMemo(
    () =>
      schedule
        .filter(item => item.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedule, selectedDate],
  );
  const selectedDayLocations = useMemo(
    () =>
      locationSegments
        .filter(segment => segment.startDate <= selectedDate && selectedDate < segment.endDate)
        .filter(hasMapCoordinates),
    [locationSegments, selectedDate],
  );
  const selectedDayStays = useMemo(
    () =>
      stays
        .filter(
          stay =>
            stay.checkOutDate === selectedDate ||
            stay.checkInDate === selectedDate ||
            (stay.checkInDate < selectedDate && selectedDate < stay.checkOutDate),
        )
        .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate)),
    [selectedDate, stays],
  );
  const selectedDayFlightRoutes = useMemo(
    () =>
      flights
        .filter(
          flight => flight.departureDate === selectedDate || flight.arrivalDate === selectedDate,
        )
        .map(flight =>
          [
            airportRouteLocation(
              'departure',
              flight.departureAirportName,
              flight.departureAirportIata,
              flight.departureAirportIcao,
            ),
            airportRouteLocation(
              'arrival',
              flight.arrivalAirportName,
              flight.arrivalAirportIata,
              flight.arrivalAirportIcao,
            ),
          ].filter((airport): airport is AirportRouteLocation => airport !== null),
        )
        .filter(route => route.length === 2),
    [flights, selectedDate],
  );
  const selectedDayGroundAirports = useMemo(() => {
    const arrivals =
      selectedDate === tripEndDate
        ? []
        : flights
            .filter(flight => flight.arrivalDate === selectedDate)
            .flatMap(flight => [
              airportRouteLocation(
                'arrival',
                flight.arrivalAirportName,
                flight.arrivalAirportIata,
                flight.arrivalAirportIcao,
              ),
            ]);
    const departures =
      selectedDate === tripStartDate
        ? []
        : flights
            .filter(flight => flight.departureDate === selectedDate)
            .flatMap(flight => [
              airportRouteLocation(
                'departure',
                flight.departureAirportName,
                flight.departureAirportIata,
                flight.departureAirportIcao,
              ),
            ]);
    const airports = [...arrivals, ...departures].filter(
      (airport): airport is AirportRouteLocation => airport !== null,
    );

    return airports.filter(
      (airport, index, all) => all.findIndex(candidate => candidate.id === airport.id) === index,
    );
  }, [flights, selectedDate, tripEndDate, tripStartDate]);
  const selectedDayArrivalAirports = selectedDayGroundAirports.filter(
    airport => airport.phase === 'arrival',
  );
  const selectedDayDepartureAirports = selectedDayGroundAirports.filter(
    airport => airport.phase === 'departure',
  );
  const selectedDayAirports = useMemo(() => {
    const airports = [...selectedDayFlightRoutes.flat(), ...selectedDayGroundAirports];
    return airports.filter(
      (airport, index, all) => all.findIndex(candidate => candidate.id === airport.id) === index,
    );
  }, [selectedDayFlightRoutes, selectedDayGroundAirports]);

  useEffect(() => {
    const inFlightAirportLookups = airportLookupsInFlight.current;
    const airportsToLoad = selectedDayAirports.filter(
      airport => !airportPlaces[airport.id] && !inFlightAirportLookups.has(airport.id),
    );
    if (!airportsToLoad.length) return;

    const controller = new AbortController();
    airportsToLoad.forEach(airport => inFlightAirportLookups.add(airport.id));

    void Promise.all(
      airportsToLoad.map(async airport => {
        try {
          const params = new URLSearchParams({ query: airport.query });
          const response = await fetch(`/api/places?${params.toString()}`, {
            signal: controller.signal,
          });
          const payload = (await response.json()) as { places?: SavedPlace[] };
          const place = response.ok ? payload.places?.[0] : undefined;
          return place ? airportPlaceFromSearch(airport, place) : null;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return null;
          return null;
        }
      }),
    ).then(resolvedAirports => {
      if (controller.signal.aborted) return;
      const resolved = resolvedAirports.filter((place): place is SavedPlace => place !== null);
      if (!resolved.length) return;
      setAirportPlaces(current => ({
        ...current,
        ...Object.fromEntries(resolved.map(place => [place.id, place])),
      }));
    });

    return () => {
      controller.abort();
      airportsToLoad.forEach(airport => inFlightAirportLookups.delete(airport.id));
    };
  }, [airportPlaces, selectedDayAirports]);

  const dayRoutePlaces = useMemo(() => {
    const routePlaces = [
      ...selectedDayArrivalAirports.map(airport => airportPlaces[airport.id]),
      ...selectedDayLocations.map(segment => locationPlaceFromSegment(segment)),
      ...selectedDayStays.map(stay =>
        stay.savedPlaceId ? places.find(place => place.id === stay.savedPlaceId) : undefined,
      ),
      ...selectedDaySchedule.map(item =>
        item.savedPlaceId ? places.find(place => place.id === item.savedPlaceId) : undefined,
      ),
      ...selectedDayDepartureAirports.map(airport => airportPlaces[airport.id]),
    ];
    const availablePlaces = routePlaces.filter((place): place is SavedPlace => Boolean(place));
    return availablePlaces.filter(
      (place, index, all) => all.findIndex(candidate => candidate.id === place.id) === index,
    );
  }, [
    airportPlaces,
    places,
    selectedDayArrivalAirports,
    selectedDayDepartureAirports,
    selectedDayLocations,
    selectedDaySchedule,
    selectedDayStays,
  ]);
  const flightRoutePlaces = useMemo(
    () =>
      selectedDayFlightRoutes
        .map(route =>
          route
            .map(airport => airportPlaces[airport.id])
            .filter((place): place is SavedPlace => Boolean(place)),
        )
        .filter(route => route.length === 2),
    [airportPlaces, selectedDayFlightRoutes],
  );

  const locationPlaces = useMemo(
    () =>
      activeLocation
        ? places.filter(place => place.locationSegmentIds?.includes(activeLocation.id))
        : [],
    [activeLocation, places],
  );
  const isShowingLocationPlaces = Boolean(activeLocation);
  const baseMapPlaces = isShowingLocationPlaces
    ? locationPlaces
    : showDayPlanOnly
      ? dayRoutePlaces
      : places;
  const mapPlaces = useMemo(() => {
    // Search results are cleared as soon as one is selected. Keep the selected
    // result in the marker set so the map can center on and display its pin.
    const extraPlaces = [
      previewPlace,
      ...[selectedPlaceId, hoveredPlaceId].map(placeId =>
        placeId ? places.find(place => place.id === placeId) : undefined,
      ),
    ].filter((place): place is SavedPlace => {
      if (!place) return false;
      if (
        place.id !== previewPlace?.id &&
        activeLocation &&
        !place.locationSegmentIds?.includes(activeLocation.id)
      ) {
        return false;
      }
      return !baseMapPlaces.some(candidate => candidate.id === place.id);
    });
    const routeOnlyPlaces = isShowingLocationPlaces
      ? []
      : [...dayRoutePlaces, ...flightRoutePlaces.flat()].filter(
          place => !baseMapPlaces.some(candidate => candidate.id === place.id),
        );
    const searchPlaces = query.trim().length >= 2 ? results : [];

    if (!extraPlaces.length && !routeOnlyPlaces.length && !searchPlaces.length)
      return baseMapPlaces;

    return [...baseMapPlaces, ...routeOnlyPlaces, ...extraPlaces, ...searchPlaces].filter(
      (place, index, all) => all.findIndex(candidate => candidate.id === place.id) === index,
    );
  }, [
    activeLocation,
    baseMapPlaces,
    dayRoutePlaces,
    flightRoutePlaces,
    hoveredPlaceId,
    isShowingLocationPlaces,
    places,
    previewPlace,
    query,
    results,
    selectedPlaceId,
  ]);
  const scheduledPlaceIds = useMemo(
    () =>
      new Set(
        selectedDaySchedule
          .map(item => item.savedPlaceId)
          .filter((id): id is string => Boolean(id)),
      ),
    [selectedDaySchedule],
  );

  function showPlace(place: SavedPlace) {
    setQuery('');
    setSearchOpen(false);
    setPlaceActionError('');
    onSelectPlace(place);
  }

  async function loadGooglePlace(placeId: string): Promise<SavedPlace> {
    const response = await fetch(`/api/places/${encodeURIComponent(placeId)}`);
    const payload = (await response.json()) as { place?: SavedPlace; error?: string };
    if (!response.ok || !payload.place)
      throw new Error(payload.error ?? 'Could not load this place.');
    return payload.place;
  }

  async function selectPlace(place: SavedPlace) {
    if (!place.providerPlaceId || place.photos !== undefined) {
      showPlace(place);
      return;
    }

    setLoadingPlaceId(place.providerPlaceId);
    setPlaceActionError('');
    try {
      showPlace(await loadGooglePlace(place.providerPlaceId));
    } catch (error) {
      showPlace(place);
      setPlaceActionError(error instanceof Error ? error.message : 'Could not load this place.');
    } finally {
      setLoadingPlaceId(null);
    }
  }

  async function selectGooglePlace(placeId: string) {
    setLoadingPlaceId(placeId);
    setPlaceActionError('');
    try {
      showPlace(await loadGooglePlace(placeId));
    } catch (error) {
      setPlaceActionError(error instanceof Error ? error.message : 'Could not load this place.');
    } finally {
      setLoadingPlaceId(null);
    }
  }

  const savedPreviewPlace = previewPlace
    ? places.find(
        place =>
          place.id === previewPlace.id ||
          (place.providerPlaceId && place.providerPlaceId === previewPlace.providerPlaceId),
      )
    : undefined;
  const previewIsSaved = Boolean(savedPreviewPlace);
  const previewPhotos = previewPlace?.photos ?? [];
  const previewPhotoIndex =
    previewPhotoSelection && previewPhotoSelection.placeId === previewPlace?.id
      ? previewPhotoSelection.index
      : 0;
  const activePreviewPhoto = previewPhotos[previewPhotoIndex] ?? previewPhotos[0];

  async function savePreviewPlace() {
    if (!previewPlace || previewIsSaved) return;
    setSavingPlaceId(previewPlace.id);
    setPlaceActionError('');
    try {
      await onSavePlace(previewPlace);
    } catch (error) {
      setPlaceActionError(error instanceof Error ? error.message : 'Could not save this place.');
    } finally {
      setSavingPlaceId(null);
    }
  }

  async function togglePreviewFavorite() {
    if (!previewPlace) return;
    setFavoritingPlaceId(previewPlace.id);
    setPlaceActionError('');
    try {
      const place = savedPreviewPlace ?? (await onSavePlace(previewPlace));
      await onToggleFavorite(place);
    } catch (error) {
      setPlaceActionError(
        error instanceof Error ? error.message : 'Could not update this favorite.',
      );
    } finally {
      setFavoritingPlaceId(null);
    }
  }

  return (
    <section
      className={`${styles.mapPanel} ${mode !== 'map' ? styles.mobileHidden : ''}`}
      data-enter
      aria-label="Map workspace"
    >
      <div className={styles.mapCanvas}>
        <GoogleMapCanvas
          places={mapPlaces}
          routePlaces={isShowingLocationPlaces ? [] : dayRoutePlaces}
          flightRoutePlaces={isShowingLocationPlaces ? [] : flightRoutePlaces}
          selectedDate={selectedDate}
          scheduledPlaceIds={scheduledPlaceIds}
          selectedPlaceId={selectedPlaceId}
          hoveredPlaceId={hoveredPlaceId}
          onSelectPlace={place => void selectPlace(place)}
          onGooglePlaceClick={placeId => void selectGooglePlace(placeId)}
          onVisiblePlaceIdsChange={onVisibleMapPlacesChange}
        />
        <div className={styles.mapControls} aria-label="Map visibility options">
          <span className={styles.mapControlLabel}>Map shows</span>
          {isShowingLocationPlaces ? (
            <span>{activeLocation?.locationName ?? 'Location'} places</span>
          ) : (
            <button
              type="button"
              className={styles.switchButton}
              role="switch"
              aria-checked={showDayPlanOnly}
              onClick={() => onShowDayPlanOnlyChange(!showDayPlanOnly)}
            >
              <span className={styles.switchTrack} aria-hidden="true">
                <span className={styles.switchThumb} />
              </span>
              <span>{showDayPlanOnly ? 'Day plan' : 'All saved places'}</span>
            </button>
          )}
        </div>
        <div ref={mapSearchRef} className={styles.mapSearch}>
          <Search size={17} />
          <input
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            placeholder={destinationLabel ? `Search ${destinationLabel}` : 'Search places'}
            aria-label="Search Google Maps places"
          />
          {query && (
            <button
              type="button"
              className={styles.clearSearch}
              onClick={() => {
                setQuery('');
                setSearchOpen(false);
              }}
              aria-label="Clear map search"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
          {searchOpen &&
            (searching || (results.length > 0 && query.trim().length >= 2)) &&
            query && (
              <div className={styles.searchResults}>
                {searching && <div className={styles.searchStatus}>Searching Google Maps…</div>}
                {results.map(place => (
                  <button key={place.id} onClick={() => void selectPlace(place)}>
                    <span
                      className={styles.searchEmoji}
                      style={{ backgroundColor: `${place.color}20`, color: place.color }}
                    >
                      {place.emoji}
                    </span>
                    <span>
                      <strong>{place.name}</strong>
                      <small>{place.subtitle}</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
                {!searching && results.length === 0 && query.trim().length >= 2 && (
                  <div className={styles.searchStatus}>No places found</div>
                )}
              </div>
            )}
        </div>
        {(searchError || placeActionError || loadingPlaceId) && (
          <div className={styles.mapSearchError} role={placeActionError ? 'alert' : 'status'}>
            {placeActionError || (loadingPlaceId ? 'Loading place details…' : searchError)}
          </div>
        )}
      </div>
      {previewPlace && (
        <div ref={previewRef} className={styles.placePreview}>
          <button
            className={styles.previewClose}
            onClick={onClosePreview}
            aria-label="Close place preview"
          >
            <X size={15} />
          </button>
          {activePreviewPhoto && (
            <div className={styles.previewGallery} aria-label={`${previewPlace.name} photos`}>
              {/* Google returns short-lived, dynamically hosted photo URLs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activePreviewPhoto.url} alt={`Photo of ${previewPlace.name}`} />
              {previewPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    className={styles.previewPhotoPrevious}
                    onClick={() =>
                      setPreviewPhotoSelection({
                        placeId: previewPlace.id,
                        index:
                          previewPhotoIndex === 0
                            ? previewPhotos.length - 1
                            : previewPhotoIndex - 1,
                      })
                    }
                    aria-label="Show previous photo"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.previewPhotoNext}
                    onClick={() =>
                      setPreviewPhotoSelection({
                        placeId: previewPlace.id,
                        index: (previewPhotoIndex + 1) % previewPhotos.length,
                      })
                    }
                    aria-label="Show next photo"
                  >
                    <ArrowRight size={16} />
                  </button>
                  <span className={styles.previewPhotoCount}>
                    {previewPhotoIndex + 1} / {previewPhotos.length}
                  </span>
                </>
              )}
              {activePreviewPhoto.attributions.length > 0 && (
                <span className={styles.previewPhotoAttribution}>
                  Photo by{' '}
                  {activePreviewPhoto.attributions.map((attribution, index) => (
                    <span key={`${attribution.name}-${attribution.uri ?? index}`}>
                      {index > 0 && ', '}
                      {attribution.uri ? (
                        <a href={attribution.uri} target="_blank" rel="noreferrer">
                          {attribution.name}
                        </a>
                      ) : (
                        attribution.name
                      )}
                    </span>
                  ))}
                </span>
              )}
            </div>
          )}
          <div
            className={styles.previewIcon}
            style={{ backgroundColor: `${previewPlace.color}18`, color: previewPlace.color }}
          >
            {previewPlace.emoji}
          </div>
          <div className={styles.previewBody}>
            <h2>{previewPlace.name}</h2>
            <p>{previewPlace.subtitle}</p>
            {previewPlace.rating && (
              <div className={styles.previewRating}>
                <Star size={13} fill="currentColor" /> {previewPlace.rating} <span>·</span> Google
                Maps
              </div>
            )}
          </div>
          <PlaceCommentForm
            key={`${previewPlace.id}-${savedPreviewPlace?.id ?? ''}-${savedPreviewPlace?.comment ?? ''}`}
            place={previewPlace}
            savedPlace={savedPreviewPlace}
            onSaveComment={onSaveComment}
            onError={setPlaceActionError}
          />
          <div className={styles.previewActions}>
            <button
              type="button"
              className={`${styles.previewFavorite} ${savedPreviewPlace?.isFavorite ? styles.previewFavoriteActive : ''}`}
              onClick={() => void togglePreviewFavorite()}
              disabled={favoritingPlaceId === previewPlace.id || savingPlaceId === previewPlace.id}
              aria-pressed={savedPreviewPlace?.isFavorite ?? false}
              aria-label={`${savedPreviewPlace?.isFavorite ? 'Remove' : 'Add'} ${previewPlace.name} ${savedPreviewPlace?.isFavorite ? 'from' : 'to'} favorites`}
              title={savedPreviewPlace?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={13} fill={savedPreviewPlace?.isFavorite ? 'currentColor' : 'none'} />
              {favoritingPlaceId === previewPlace.id
                ? 'Saving…'
                : savedPreviewPlace?.isFavorite
                  ? 'Favorited'
                  : 'Favorite'}
            </button>
            <button
              type="button"
              onClick={() => void savePreviewPlace()}
              disabled={previewIsSaved || savingPlaceId === previewPlace.id}
            >
              <MapPinPlus size={13} />
              {previewIsSaved
                ? 'Pinned to trip'
                : savingPlaceId === previewPlace.id
                  ? 'Saving…'
                  : 'Add pin'}
            </button>
            <button
              type="button"
              className={styles.previewPrimary}
              onClick={() => onAddToDay(previewPlace)}
            >
              Add to {selectedDayLabel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
