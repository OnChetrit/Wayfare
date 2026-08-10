import { X } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import styles from './LocationPlanPanel.module.scss';
import { categoryMeta } from './data';
import { parseTimelineDragPayload, setTimelineDragPayload } from './timeline-dnd';
import type { EditorMode, LocationSegment, SavedPlace } from './types';

type LocationPlanPanelProps = {
  mode: EditorMode;
  location: LocationSegment | null;
  places: SavedPlace[];
  selectedPlaceId: string | null;
  onSelectPlace: (place: SavedPlace) => void;
  onAddPlace: (place: SavedPlace, location: LocationSegment) => Promise<void> | void;
  onRemovePlace: (place: SavedPlace, location: LocationSegment) => Promise<void> | void;
  onClose: () => void;
};

function formatLocationDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  const format = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
    return `${format.format(start)}–${end.getUTCDate()}`;
  }

  return `${format.format(start)}–${format.format(end)}`;
}

export function LocationPlanPanel({
  mode,
  location,
  places,
  selectedPlaceId,
  onSelectPlace,
  onAddPlace,
  onRemovePlace,
  onClose,
}: LocationPlanPanelProps) {
  const [draggingOver, setDraggingOver] = useState(false);
  const locationPlaces = location
    ? places.filter(place => place.locationSegmentIds?.includes(location.id))
    : [];

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDraggingOver(false);
    const payload = parseTimelineDragPayload(event);
    if (!location || !payload || payload.type !== 'place') return;
    const place = places.find(item => item.id === payload.placeId);
    if (place) void onAddPlace(place, location);
  }

  return (
    <aside className={`${styles.locationPanel} ${mode === 'day' ? styles.mobileVisible : ''}`} data-enter>
      <div className={styles.panelHeader}>
        <div className={styles.locationHeading}>
          <h1>{location?.locationName ?? 'Choose a location'}</h1>
          <p>{location ? formatLocationDateRange(location.startDate, location.endDate) : 'Select a location above the dates.'}</p>
        </div>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close location plan"><X size={16} /></button>
      </div>
      {location && (
        <>
          <div
            className={`${styles.places} ${draggingOver ? styles.placesDropActive : ''}`}
            onDragOver={event => { event.preventDefault(); setDraggingOver(true); }}
            onDragLeave={event => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingOver(false);
            }}
            onDrop={handleDrop}
          >
            <div className={styles.placesHeading}><span>SHORTLIST</span><strong>{locationPlaces.length}</strong></div>
            {locationPlaces.map(place => (
              <article
                key={place.id}
                className={`${styles.placeCard} ${selectedPlaceId === place.id ? styles.placeCardSelected : ''}`}
                draggable
                onDragStart={event => setTimelineDragPayload(event, { type: 'place', placeId: place.id })}
                onClick={() => onSelectPlace(place)}
              >
                <span className={styles.placeIcon} style={{ backgroundColor: `${place.color}18`, color: place.color }}>{place.emoji}</span>
                <span><strong>{place.name}</strong><small>{categoryMeta[place.category].label}</small></span>
                <button type="button" onClick={event => { event.stopPropagation(); void onRemovePlace(place, location); }} aria-label={`Remove ${place.name} from ${location.locationName}`}><X size={14} /></button>
              </article>
            ))}
            {!locationPlaces.length && <p className={styles.empty}>Your location shortlist is empty.</p>}
          </div>
        </>
      )}
    </aside>
  );
}
