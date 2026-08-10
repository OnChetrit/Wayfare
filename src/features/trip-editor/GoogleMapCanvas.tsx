'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './GoogleMapCanvas.module.scss';
import type { SavedPlace } from './types';

type GoogleMapInstance = {
  setCenter: (position: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  getCenter: () => GoogleLatLng | undefined;
  getZoom: () => number | undefined;
  getBounds: () => GoogleLatLngBounds | undefined;
  addListener: (
    eventName: string,
    handler: (event?: GoogleMapClickEvent) => void,
  ) => { remove: () => void };
};

type GoogleLatLngBounds = {
  contains: (position: { lat: number; lng: number }) => boolean;
};

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GooglePolyline = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleMapClickEvent = {
  placeId?: string;
  stop?: () => void;
};

type GoogleApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    Polyline: new (options: Record<string, unknown>) => GooglePolyline;
    marker?: {
      AdvancedMarkerElement: new (options: {
        map: GoogleMapInstance;
        position: { lat: number; lng: number };
        title: string;
        content: HTMLElement;
      }) => GoogleAdvancedMarker;
    };
  };
};

type GoogleAdvancedMarker = {
  map: GoogleMapInstance | null;
};

type GoogleMarkerState = {
  marker: GoogleAdvancedMarker;
  content: HTMLButtonElement;
  icon: HTMLSpanElement;
  place: SavedPlace;
};

const emptyMapCenter = { lat: 20, lng: 0 };
const mapFitPadding = 80;
const maxMercatorLatitude = 85.05112878;

type MapPosition = { lat: number; lng: number };
type MapCamera = { center: MapPosition; zoom: number };

function clampMercatorLatitude(latitude: number) {
  return Math.max(-maxMercatorLatitude, Math.min(maxMercatorLatitude, latitude));
}

function mercatorY(latitude: number) {
  const radians = (clampMercatorLatitude(latitude) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
}

function inverseMercatorY(value: number) {
  const radians = Math.atan(Math.sinh(Math.PI * (1 - 2 * value)));
  return (radians * 180) / Math.PI;
}

function normalizeLongitude(longitude: number) {
  return ((longitude + 540) % 360) - 180;
}

function interpolateLongitude(from: number, to: number, progress: number) {
  let difference = to - from;
  if (difference > 180) difference -= 360;
  if (difference < -180) difference += 360;
  return normalizeLongitude(from + difference * progress);
}

function getFittedCamera(places: SavedPlace[], width: number, height: number): MapCamera | null {
  if (!places.length) return null;
  if (places.length === 1) {
    return {
      center: { lat: places[0].lat, lng: places[0].lng },
      zoom: 15,
    };
  }
  if (width <= mapFitPadding * 2 || height <= mapFitPadding * 2) return null;

  const firstLongitude = places[0].lng;
  const longitudes = places.map(place => {
    let longitude = place.lng;
    while (longitude - firstLongitude > 180) longitude -= 360;
    while (longitude - firstLongitude < -180) longitude += 360;
    return longitude;
  });
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...places.map(place => place.lat));
  const maxLatitude = Math.max(...places.map(place => place.lat));
  const longitudeSpan = (maxLongitude - minLongitude) / 360;
  const latitudeSpan = mercatorY(minLatitude) - mercatorY(maxLatitude);
  const xSpan = Math.max(longitudeSpan, 1 / 256);
  const ySpan = Math.max(latitudeSpan, 1 / 256);
  const availableWidth = width - mapFitPadding * 2;
  const availableHeight = height - mapFitPadding * 2;
  const zoom =
    longitudeSpan < 1e-8 && latitudeSpan < 1e-8
      ? 15
      : Math.floor(
          Math.log2(Math.min(availableWidth / (256 * xSpan), availableHeight / (256 * ySpan))),
        );

  return {
    center: {
      lat: inverseMercatorY((mercatorY(minLatitude) + mercatorY(maxLatitude)) / 2),
      lng: normalizeLongitude((minLongitude + maxLongitude) / 2),
    },
    zoom: Math.max(2, Math.min(20, zoom)),
  };
}

type GoogleMapCanvasProps = {
  places: SavedPlace[];
  routePlaces: SavedPlace[];
  flightRoutePlaces: SavedPlace[][];
  selectedDate: string;
  scheduledPlaceIds: Set<string>;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  onSelectPlace: (place: SavedPlace) => void;
  onGooglePlaceClick: (placeId: string) => void;
  onVisiblePlaceIdsChange: (placeIds: string[]) => void;
};

export function GoogleMapCanvas({
  places,
  routePlaces,
  flightRoutePlaces,
  selectedDate,
  scheduledPlaceIds,
  selectedPlaceId,
  hoveredPlaceId,
  onSelectPlace,
  onGooglePlaceClick,
  onVisiblePlaceIdsChange,
}: GoogleMapCanvasProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMapInstance | null>(null);
  const markers = useRef<Map<string, GoogleMarkerState>>(new Map());
  const lastFittedViewportKey = useRef<string | null>(null);
  const lastCenteredPlaceId = useRef<string | null>(null);
  const cameraAnimationFrame = useRef<number | null>(null);
  const cameraTransitionId = useRef(0);
  const preservedCamera = useRef<MapCamera | null>(null);
  const latestPlaces = useRef(places);
  const latestRoutePlaces = useRef(routePlaces);
  const latestHoveredPlaceId = useRef(hoveredPlaceId);
  const previousHoveredPlaceId = useRef<string | null>(null);
  const visiblePlaceIds = useRef<string[]>([]);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState('');
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark',
  );
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const onGooglePlaceClickRef = useRef(onGooglePlaceClick);
  const onSelectPlaceRef = useRef(onSelectPlace);
  const onVisiblePlaceIdsChangeRef = useRef(onVisiblePlaceIdsChange);

  useEffect(() => {
    if (!apiKey || scriptReady) return;

    let attempts = 0;
    const maxAttempts = 200;
    let timeoutId: number | null = null;

    function check() {
      const googleApi = (window as Window & { google?: GoogleApi }).google;
      if (typeof googleApi?.maps?.Map === 'function') {
        setScriptReady(true);
        return;
      }
      if (attempts >= maxAttempts) {
        setScriptError('Google Maps finished loading without exposing the map constructor.');
        return;
      }
      attempts += 1;
      timeoutId = window.setTimeout(check, 25);
    }

    check();

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [apiKey, scriptReady]);

  useEffect(() => {
    onGooglePlaceClickRef.current = onGooglePlaceClick;
  }, [onGooglePlaceClick]);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  useEffect(() => {
    onVisiblePlaceIdsChangeRef.current = onVisiblePlaceIdsChange;
  }, [onVisiblePlaceIdsChange]);

  useEffect(() => {
    latestHoveredPlaceId.current = hoveredPlaceId;
  }, [hoveredPlaceId]);

  useEffect(() => {
    latestPlaces.current = places;
  }, [places]);

  useEffect(() => {
    latestRoutePlaces.current = routePlaces;
  }, [routePlaces]);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.dataset.theme === 'dark');
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    syncTheme();
    return () => observer.disconnect();
  }, []);

  const updateVisiblePlaceIds = useCallback(() => {
    const bounds = map.current?.getBounds();
    if (!bounds) return;
    const nextVisiblePlaceIds = latestPlaces.current
      .filter(place => bounds.contains({ lat: place.lat, lng: place.lng }))
      .map(place => place.id);
    if (
      nextVisiblePlaceIds.length === visiblePlaceIds.current.length &&
      nextVisiblePlaceIds.every((placeId, index) => placeId === visiblePlaceIds.current[index])
    ) {
      return;
    }
    visiblePlaceIds.current = nextVisiblePlaceIds;
    onVisiblePlaceIdsChangeRef.current(nextVisiblePlaceIds);
  }, []);

  useEffect(() => {
    if (!scriptReady || !mapElement.current || map.current) return;
    const mapContainer = mapElement.current;
    const googleApi = (window as Window & { google?: GoogleApi }).google;
    if (!googleApi?.maps) return;
    const initialPlace = latestRoutePlaces.current[0] ?? latestPlaces.current[0];
    const initialCamera =
      preservedCamera.current ??
      ({
        center: initialPlace ? { lat: initialPlace.lat, lng: initialPlace.lng } : emptyMapCenter,
        zoom: initialPlace ? 13 : 2,
      } satisfies MapCamera);
    const mapInstance = new googleApi.maps.Map(mapContainer, {
      center: initialCamera.center,
      zoom: initialCamera.zoom,
      colorScheme: isDarkTheme ? 'DARK' : 'LIGHT',
      mapId,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: true,
    });
    map.current = mapInstance;
    preservedCamera.current = null;

    return () => {
      const currentCenter = mapInstance.getCenter();
      if (currentCenter) {
        preservedCamera.current = {
          center: { lat: currentCenter.lat(), lng: currentCenter.lng() },
          zoom: mapInstance.getZoom() ?? initialCamera.zoom,
        };
      }
      cameraTransitionId.current += 1;
      if (cameraAnimationFrame.current !== null) {
        window.cancelAnimationFrame(cameraAnimationFrame.current);
        cameraAnimationFrame.current = null;
      }
      map.current = null;
      mapContainer.replaceChildren();
    };
  }, [isDarkTheme, mapId, scriptReady]);

  useEffect(() => {
    if (!map.current) return;
    const clickListener = map.current.addListener('click', event => {
      if (!event?.placeId) return;
      event.stop?.();
      onGooglePlaceClickRef.current(event.placeId);
    });
    const idleListener = map.current.addListener('idle', () => updateVisiblePlaceIds());
    updateVisiblePlaceIds();
    return () => {
      clickListener.remove();
      idleListener.remove();
    };
  }, [isDarkTheme, scriptReady, updateVisiblePlaceIds]);

  useEffect(() => {
    updateVisiblePlaceIds();
  }, [places, updateVisiblePlaceIds]);

  const stopCameraTransition = useCallback(() => {
    cameraTransitionId.current += 1;
    if (cameraAnimationFrame.current === null) return;
    window.cancelAnimationFrame(cameraAnimationFrame.current);
    cameraAnimationFrame.current = null;
  }, []);

  const transitionToCamera = useCallback(
    (targetCamera: MapCamera) => {
      const mapInstance = map.current;
      if (!mapInstance) return;
      const activeMapInstance = mapInstance;

      stopCameraTransition();
      const transitionId = cameraTransitionId.current;
      const currentCenter = mapInstance.getCenter();
      const startCamera: MapCamera = {
        center: currentCenter
          ? { lat: currentCenter.lat(), lng: currentCenter.lng() }
          : targetCamera.center,
        zoom: mapInstance.getZoom() ?? 13,
      };
      const zoomOut = Math.max(2, Math.min(startCamera.zoom, targetCamera.zoom) - 2.5);

      function animatePhase(
        from: MapCamera,
        to: MapCamera,
        duration: number,
        onComplete?: () => void,
      ) {
        const startedAt = performance.now();
        const animate = (now: number) => {
          if (cameraTransitionId.current !== transitionId) return;
          const progress = Math.min(1, (now - startedAt) / duration);
          const easedProgress = progress * progress * (3 - 2 * progress);
          activeMapInstance.setCenter({
            lat: from.center.lat + (to.center.lat - from.center.lat) * easedProgress,
            lng: interpolateLongitude(from.center.lng, to.center.lng, easedProgress),
          });
          activeMapInstance.setZoom(from.zoom + (to.zoom - from.zoom) * easedProgress);

          if (progress < 1) {
            cameraAnimationFrame.current = window.requestAnimationFrame(animate);
          } else if (onComplete) {
            onComplete();
          } else {
            cameraAnimationFrame.current = null;
          }
        };

        cameraAnimationFrame.current = window.requestAnimationFrame(animate);
      }

      // Always use the same cinematic sequence: widen the view, move to the
      // next location while zoomed out, then settle into the target zoom.
      animatePhase(startCamera, { center: startCamera.center, zoom: zoomOut }, 260, () =>
        animatePhase(
          { center: startCamera.center, zoom: zoomOut },
          { center: targetCamera.center, zoom: zoomOut },
          420,
          () => animatePhase({ center: targetCamera.center, zoom: zoomOut }, targetCamera, 360),
        ),
      );
    },
    [stopCameraTransition],
  );

  useEffect(() => {
    return () => {
      stopCameraTransition();
    };
  }, [stopCameraTransition]);

  useEffect(() => {
    if (!map.current || !scriptReady) return;

    // Keep the selected day's route in view when the day changes. The previous
    // implementation only fitted the initial set of places, so later days
    // could render markers outside the camera's current bounds.
    const routeViewportPlaces = [...routePlaces, ...flightRoutePlaces.flat()].filter(
      (place, index, all) => all.findIndex(candidate => candidate.id === place.id) === index,
    );
    const viewportPlaces = routeViewportPlaces.length ? routeViewportPlaces : places;
    if (!viewportPlaces.length) return;
    const viewportKey = `${selectedDate}:${routeViewportPlaces.length ? 'route' : 'places'}:${viewportPlaces.map(place => `${place.id}@${place.lat},${place.lng}`).join('|')}`;
    if (lastFittedViewportKey.current === viewportKey) return;

    const targetCamera = getFittedCamera(
      viewportPlaces,
      Math.max(mapElement.current?.clientWidth ?? 0, 320),
      Math.max(mapElement.current?.clientHeight ?? 0, 240),
    );
    if (!targetCamera) return;
    transitionToCamera(targetCamera);
    lastFittedViewportKey.current = viewportKey;
  }, [
    flightRoutePlaces,
    isDarkTheme,
    places,
    routePlaces,
    scriptReady,
    selectedDate,
    transitionToCamera,
  ]);

  useEffect(() => {
    if (!selectedPlaceId) {
      lastCenteredPlaceId.current = null;
      return;
    }
    if (!map.current || lastCenteredPlaceId.current === selectedPlaceId) return;
    const selectedPlace = places.find(place => place.id === selectedPlaceId);
    if (!selectedPlace) return;
    transitionToCamera({
      center: { lat: selectedPlace.lat, lng: selectedPlace.lng },
      zoom: 15,
    });
    lastCenteredPlaceId.current = selectedPlaceId;
  }, [places, selectedPlaceId, transitionToCamera]);

  useEffect(() => {
    if (!map.current || routePlaces.length < 2) return;
    const googleApi = (window as Window & { google?: GoogleApi }).google;
    if (!googleApi?.maps?.Polyline) return;
    const routeLine = new googleApi.maps.Polyline({
      map: map.current,
      path: routePlaces.map(place => ({ lat: place.lat, lng: place.lng })),
      geodesic: true,
      strokeColor: '#477d67',
      strokeOpacity: 0.82,
      strokeWeight: 3,
      zIndex: 1,
    });
    return () => routeLine.setMap(null);
  }, [isDarkTheme, routePlaces]);

  useEffect(() => {
    if (!map.current || !flightRoutePlaces.length) return;
    const googleApi = (window as Window & { google?: GoogleApi }).google;
    if (!googleApi?.maps?.Polyline) return;
    const flightLines = flightRoutePlaces.map(
      route =>
        new googleApi.maps.Polyline({
          map: map.current,
          path: route.map(place => ({ lat: place.lat, lng: place.lng })),
          geodesic: true,
          strokeColor: '#4d7fa3',
          strokeOpacity: 0.9,
          strokeWeight: 3,
          zIndex: 1,
        }),
    );
    return () => flightLines.forEach(line => line.setMap(null));
  }, [flightRoutePlaces, isDarkTheme]);

  useEffect(() => {
    if (!map.current) return;
    const googleApi = (window as Window & { google?: GoogleApi }).google;
    const AdvancedMarkerElement = googleApi?.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarkerElement) return;

    const placeIds = new Set(places.map(place => place.id));
    markers.current.forEach((state, placeId) => {
      if (placeIds.has(placeId)) return;
      state.marker.map = null;
      markers.current.delete(placeId);
    });

    places.forEach(place => {
      let state = markers.current.get(place.id);
      if (state && (state.place.lat !== place.lat || state.place.lng !== place.lng)) {
        state.marker.map = null;
        markers.current.delete(place.id);
        state = undefined;
      }

      if (state) {
        state.place = place;
        state.marker.map = map.current;
        state.content.title = place.name;
        state.content.dataset.selected = String(place.id === selectedPlaceId);
        state.content.dataset.hovered = String(place.id === latestHoveredPlaceId.current);
        state.content.dataset.scheduled = String(scheduledPlaceIds.has(place.id));
        state.content.style.backgroundColor = place.color;
        state.icon.textContent = place.emoji;
        return;
      }

      const content = document.createElement('button');
      content.type = 'button';
      content.className = styles.googleMarker;
      const icon = document.createElement('span');
      icon.textContent = place.emoji;
      content.append(icon);
      content.title = place.name;
      content.dataset.selected = String(place.id === selectedPlaceId);
      content.dataset.hovered = String(place.id === latestHoveredPlaceId.current);
      content.dataset.scheduled = String(scheduledPlaceIds.has(place.id));
      content.style.backgroundColor = place.color;
      const markerState = {} as GoogleMarkerState;
      markerState.content = content;
      markerState.icon = icon;
      markerState.place = place;
      content.addEventListener('click', () => onSelectPlaceRef.current(markerState.place));
      markerState.marker = new AdvancedMarkerElement({
        map: map.current as GoogleMapInstance,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        content,
      });
      markers.current.set(place.id, markerState);
    });
  }, [isDarkTheme, places, scheduledPlaceIds, scriptReady, selectedPlaceId]);

  useEffect(() => {
    if (previousHoveredPlaceId.current && previousHoveredPlaceId.current !== hoveredPlaceId) {
      const previousMarker = markers.current.get(previousHoveredPlaceId.current);
      if (previousMarker) previousMarker.content.dataset.hovered = 'false';
    }
    if (hoveredPlaceId) {
      const hoveredMarker = markers.current.get(hoveredPlaceId);
      if (hoveredMarker) hoveredMarker.content.dataset.hovered = 'true';
    }
    previousHoveredPlaceId.current = hoveredPlaceId;
  }, [hoveredPlaceId]);

  useEffect(() => {
    const markerStates = markers.current;
    return () => {
      markerStates.forEach(state => {
        state.marker.map = null;
      });
      markerStates.clear();
    };
  }, []);

  function zoomBy(amount: number) {
    if (!map.current) return;
    transitionToCamera({
      center: map.current.getCenter()
        ? { lat: map.current.getCenter()!.lat(), lng: map.current.getCenter()!.lng() }
        : emptyMapCenter,
      zoom: Math.max(2, Math.min(20, (map.current.getZoom() ?? 13) + amount)),
    });
  }

  return (
    <div className={styles.googleMapFrame}>
      {apiKey && (
        <Script
          id="google-maps-js"
          src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker&v=weekly&loading=async`}
          strategy="afterInteractive"
          onError={() =>
            setScriptError(
              'Google Maps could not load. Check the browser key and allowed referrers.',
            )
          }
        />
      )}
      <div className={styles.mapTexture} />
      {apiKey ? (
        <div className={styles.googleMap} ref={mapElement} />
      ) : (
        <div className={styles.googleMapMessage}>
          Add a browser-restricted Google Maps key to render the live map.
        </div>
      )}
      {!scriptReady && apiKey && (
        <div className={styles.googleMapMessage}>Loading Google Maps…</div>
      )}
      {scriptError && <div className={styles.googleMapError}>{scriptError}</div>}
      <div className={styles.mapZoom}>
        <button onClick={() => zoomBy(1)} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => zoomBy(-1)} aria-label="Zoom out">
          −
        </button>
      </div>
    </div>
  );
}
