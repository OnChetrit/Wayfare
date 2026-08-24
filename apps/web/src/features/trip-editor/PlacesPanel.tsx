import {
  ChevronDown,
  ListPlus,
  MapPin,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './PlacesPanel.module.scss';
import { categoryMeta } from './data';
import { usePlaceHover } from './PlaceHoverContext';
import { setTimelineDragPayload } from './timeline-dnd';
import type {
  EditorMode,
  LocationSegment,
  PlacesFilter,
  SavedPlace,
  ScheduleItem,
  TripDay,
} from './types';
import { useClickOutside } from './use-click-outside';

const filterOptions: PlacesFilter[] = [
  'ALL',
  'FAVORITES',
  'HOTEL',
  'RESTAURANT',
  'CAFE',
  'BAR',
  'ATTRACTION',
  'SHOPPING',
  'TRANSPORT',
  'CUSTOM',
];

type PlacesPanelProps = {
  mode: EditorMode;
  places: SavedPlace[];
  filteredPlaces: SavedPlace[];
  locationCandidatePlaces: SavedPlace[];
  activeLocation: LocationSegment | null;
  locationPlaces: SavedPlace[];
  schedule: ScheduleItem[];
  filter: PlacesFilter;
  selectedPlaceId: string | null;
  selectedDay: TripDay | null;
  libraryQuery: string;
  showOnlyVisiblePlaces: boolean;
  onFilterChange: (filter: PlacesFilter) => void;
  onQueryChange: (query: string) => void;
  onShowOnlyVisiblePlacesChange: (value: boolean) => void;
  onSelectPlace: (place: SavedPlace) => void;
  onAddToDay: (place: SavedPlace) => void;
  onAddToLocation: (place: SavedPlace, location: LocationSegment) => Promise<void> | void;
  onRemoveFromLocation: (place: SavedPlace, location: LocationSegment) => Promise<void> | void;
  onToggleFavorite: (place: SavedPlace) => Promise<void> | void;
  onDeletePlace: (place: SavedPlace) => Promise<void> | void;
  onImportGoogleList: (url: string) => Promise<GoogleListImportResult>;
};

type GoogleListImportResult = {
  listName?: string;
  importedCount: number;
  skippedCount: number;
};

export function PlacesPanel({
  mode,
  places,
  filteredPlaces,
  locationCandidatePlaces,
  activeLocation,
  locationPlaces,
  schedule,
  filter,
  selectedPlaceId,
  selectedDay,
  libraryQuery,
  showOnlyVisiblePlaces,
  onFilterChange,
  onQueryChange,
  onShowOnlyVisiblePlacesChange,
  onSelectPlace,
  onAddToDay,
  onAddToLocation,
  onRemoveFromLocation,
  onToggleFavorite,
  onDeletePlace,
  onImportGoogleList,
}: PlacesPanelProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [selectedPlacesOpen, setSelectedPlacesOpen] = useState(false);
  const [locationPlacesOpen, setLocationPlacesOpen] = useState(true);
  const [locationScope, setLocationScope] = useState<{ id: string; visible: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsDialogRef = useRef<HTMLDialogElement>(null);
  const { setHoveredPlaceId } = usePlaceHover();

  const showLocationPlaces = activeLocation
    ? locationScope?.id === activeLocation.id
      ? locationScope.visible
      : true
    : false;

  useClickOutside(
    toolbarRef,
    () => {
      setImportOpen(false);
      setImportError('');
    },
    importOpen,
  );
  useEffect(() => {
    const dialog = settingsDialogRef.current;
    if (!dialog) return;
    if (settingsOpen && !dialog.open) dialog.showModal();
    if (!settingsOpen && dialog.open) dialog.close();
  }, [settingsOpen]);
  const scheduledPlaces = useMemo(() => {
    const datesByPlace = new Map<string, string[]>();
    schedule.forEach(item => {
      if (!item.savedPlaceId) return;
      const dates = datesByPlace.get(item.savedPlaceId) ?? [];
      if (!dates.includes(item.date)) dates.push(item.date);
      datesByPlace.set(item.savedPlaceId, dates);
    });

    return places
      .filter(place => datesByPlace.has(place.id))
      .map(place => ({
        place,
        dates: [...(datesByPlace.get(place.id) ?? [])].sort(),
      }))
      .sort((a, b) => {
        const firstDate = a.dates[0]?.localeCompare(b.dates[0] ?? '') ?? 0;
        return firstDate || a.place.name.localeCompare(b.place.name);
      });
  }, [places, schedule]);
  const locationPlaceIds = useMemo(
    () => new Set(locationPlaces.map(place => place.id)),
    [locationPlaces],
  );
  const availablePlaces = useMemo(
    () =>
      activeLocation && showLocationPlaces
        ? locationCandidatePlaces.filter(place => !locationPlaceIds.has(place.id))
        : filteredPlaces,
    [activeLocation, filteredPlaces, locationCandidatePlaces, locationPlaceIds, showLocationPlaces],
  );
  const activeFilterCount = Number(showOnlyVisiblePlaces) + Number(filter !== 'ALL');

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  async function importGoogleList(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError('');
    setImportNotice('');
    try {
      const result = await onImportGoogleList(importUrl.trim());
      const listLabel = result.listName ? ` from “${result.listName}”` : '';
      setImportNotice(
        result.importedCount
          ? `Imported ${result.importedCount} place${result.importedCount === 1 ? '' : 's'}${listLabel}.${result.skippedCount ? ` ${result.skippedCount} already existed or could not be read.` : ''}`
          : `No new places were found${listLabel}.`,
      );
      setImportUrl('');
      setImportOpen(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not import that list.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <aside
      className={`${styles.placePanel} ${mode === 'places' ? styles.mobileVisible : ''}`}
      data-enter
    >
      <div ref={toolbarRef} className={styles.libraryToolbar}>
        <div className={styles.libraryHeader}>
          <div>
            <h2>
              {activeLocation && showLocationPlaces
                ? `${activeLocation.locationName} places`
                : 'Saved places'}{' '}
              <span>
                {activeLocation && showLocationPlaces ? locationPlaces.length : places.length}
              </span>
            </h2>
          </div>
          <button
            type="button"
            className={styles.roundAdd}
            onClick={() => {
              setImportOpen(open => !open);
              setImportError('');
              setImportNotice('');
              setSettingsOpen(false);
            }}
            aria-label="Import a Google Maps list"
            title="Import Google Maps list"
          >
            <ListPlus size={17} />
          </button>
        </div>
        {importOpen && (
          <form className={styles.importForm} onSubmit={event => void importGoogleList(event)}>
            <label htmlFor="google-list-url">Google Maps shared list link</label>
            <input
              id="google-list-url"
              type="url"
              value={importUrl}
              onChange={event => setImportUrl(event.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              autoFocus
              required
            />
            <p>Use a shared or public list link from Google Maps.</p>
            <div className={styles.importActions}>
              <button
                type="button"
                className={styles.importCancel}
                onClick={() => {
                  setImportOpen(false);
                  setImportError('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className={styles.importSubmit} disabled={importing}>
                {importing ? 'Importing…' : 'Import list'}
              </button>
            </div>
            {importError && <div className={styles.importError}>{importError}</div>}
          </form>
        )}
        {importNotice && (
          <div className={styles.importNotice} role="status">
            {importNotice}
          </div>
        )}
        <div className={styles.searchContainer}>
          <div className={styles.librarySearch}>
            <Search size={15} />
            <input
              value={libraryQuery}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="Search places"
              aria-label="Search saved places"
            />
            {libraryQuery && (
              <button
                type="button"
                className={styles.clearSearch}
                onClick={() => onQueryChange('')}
                aria-label="Clear saved places search"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className={styles.settingsMenuWrap}>
            <button
              type="button"
              className={styles.settingsButton}
              onClick={() => {
                setSettingsOpen(true);
                setImportOpen(false);
              }}
              aria-haspopup="dialog"
              aria-label="Place settings"
              title="Place settings"
            >
              <Settings2 size={16} />
              {activeFilterCount > 0 && (
                <span
                  className={styles.settingsBadge}
                  aria-label={`${activeFilterCount} active filters`}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <dialog
          ref={settingsDialogRef}
          className={styles.settingsDialog}
          onClick={event => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
          onCancel={event => {
            event.preventDefault();
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        >
          <div className={styles.settingsDialogHeader}>
            <div>
              <h2>Place settings</h2>
            </div>
            <button
              type="button"
              className={styles.settingsDialogClose}
              onClick={() => setSettingsOpen(false)}
              aria-label="Close place settings"
            >
              <X size={17} />
            </button>
          </div>
          {activeLocation && (
            <section className={styles.settingsSection} aria-labelledby="place-view-heading">
              <span id="place-view-heading" className={styles.settingsLabel}>
                View
              </span>
              <div className={styles.settingsChoices}>
                <button
                  type="button"
                  className={!showLocationPlaces ? styles.settingActive : ''}
                  onClick={() => setLocationScope({ id: activeLocation.id, visible: false })}
                  aria-pressed={!showLocationPlaces}
                >
                  All saved places
                </button>
                <button
                  type="button"
                  className={showLocationPlaces ? styles.settingActive : ''}
                  onClick={() => setLocationScope({ id: activeLocation.id, visible: true })}
                  aria-pressed={showLocationPlaces}
                >
                  <MapPin size={13} />
                  {activeLocation.locationName} shortlist
                </button>
              </div>
            </section>
          )}
          <section className={styles.settingsSection}>
            <button
              type="button"
              className={styles.settingsSwitch}
              role="switch"
              aria-checked={showOnlyVisiblePlaces}
              onClick={() => onShowOnlyVisiblePlacesChange(!showOnlyVisiblePlaces)}
            >
              <span>
                <strong>Map area only</strong>
                <small>Show places visible on the map</small>
              </span>
              <span
                className={`${styles.switchTrack} ${showOnlyVisiblePlaces ? styles.switchOn : ''}`}
                aria-hidden="true"
              >
                <span className={styles.switchThumb} />
              </span>
            </button>
          </section>
          <section className={styles.settingsSection} aria-labelledby="place-category-heading">
            <span id="place-category-heading" className={styles.settingsLabel}>
              Category
            </span>
            <div className={styles.categoryChoices}>
              {filterOptions.map(option => (
                <button
                  key={option}
                  type="button"
                  className={filter === option ? styles.settingActive : ''}
                  onClick={() => onFilterChange(option)}
                  aria-pressed={filter === option}
                >
                  {option === 'ALL'
                    ? 'All places'
                    : option === 'FAVORITES'
                      ? 'Favorites'
                      : categoryMeta[option].label}
                </button>
              ))}
            </div>
          </section>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className={styles.resetSettings}
              onClick={() => {
                onFilterChange('ALL');
                onShowOnlyVisiblePlacesChange(false);
              }}
            >
              Reset filters
            </button>
          )}
        </dialog>
      </div>
      <div className={styles.placeList}>
        {scheduledPlaces.length > 0 && (
          <section
            className={`${styles.selectedSection} ${!selectedPlacesOpen ? styles.selectedSectionCollapsed : ''}`}
            aria-labelledby="selected-places-heading"
          >
            <div className={styles.sectionHeading}>
              <button
                type="button"
                className={styles.sectionToggle}
                onClick={() => setSelectedPlacesOpen(open => !open)}
                aria-expanded={selectedPlacesOpen}
                aria-controls="selected-places-list"
              >
                <span id="selected-places-heading">Scheduled places</span>
                <span className={styles.sectionHeadingMeta}>
                  <strong>{scheduledPlaces.length}</strong>
                  <ChevronDown size={13} aria-hidden="true" />
                </span>
              </button>
            </div>
            <div
              id="selected-places-list"
              className={styles.selectedPlaceListWrapper}
              aria-hidden={!selectedPlacesOpen}
            >
              <div className={styles.selectedPlaceList}>
                {scheduledPlaces.map(({ place, dates }) => (
                  <article
                    key={place.id}
                    className={`${styles.placeCard} ${styles.selectedPlaceCard} ${selectedPlaceId === place.id ? styles.placeCardSelected : ''}`}
                    onMouseEnter={() => setHoveredPlaceId(place.id)}
                    onMouseLeave={() => setHoveredPlaceId(null)}
                    onClick={() => onSelectPlace(place)}
                  >
                    <div
                      className={styles.placeIcon}
                      style={{ backgroundColor: `${place.color}18`, color: place.color }}
                    >
                      {place.emoji}
                    </div>
                    <div className={styles.placeInfo}>
                      <strong>{place.name}</strong>
                      <span>{place.subtitle}</span>
                      <small>{dates.map(formatDate).join(' · ')}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
        {activeLocation && showLocationPlaces && (
          <section
            className={`${styles.selectedSection} ${!locationPlacesOpen ? styles.selectedSectionCollapsed : ''}`}
            aria-labelledby="location-places-heading"
          >
            <div className={styles.sectionHeading}>
              <button
                type="button"
                className={styles.sectionToggle}
                onClick={() => setLocationPlacesOpen(open => !open)}
                aria-expanded={locationPlacesOpen}
                aria-controls="location-places-list"
              >
                <span id="location-places-heading">Places for {activeLocation.locationName}</span>
                <span className={styles.sectionHeadingMeta}>
                  <strong>{locationPlaces.length}</strong>
                  <ChevronDown size={13} aria-hidden="true" />
                </span>
              </button>
            </div>
            <div
              id="location-places-list"
              className={styles.selectedPlaceListWrapper}
              aria-hidden={!locationPlacesOpen}
            >
              <div className={styles.selectedPlaceList}>
                {locationPlaces.map(place => (
                  <article
                    key={place.id}
                    className={`${styles.placeCard} ${styles.selectedPlaceCard} ${selectedPlaceId === place.id ? styles.placeCardSelected : ''}`}
                    draggable
                    onMouseEnter={() => setHoveredPlaceId(place.id)}
                    onMouseLeave={() => setHoveredPlaceId(null)}
                    onDragStart={event =>
                      setTimelineDragPayload(event, { type: 'place', placeId: place.id })
                    }
                    onClick={() => onSelectPlace(place)}
                  >
                    <div
                      className={styles.placeIcon}
                      style={{ backgroundColor: `${place.color}18`, color: place.color }}
                    >
                      {place.emoji}
                    </div>
                    <div className={styles.placeInfo}>
                      <strong>{place.name}</strong>
                      <span>{place.subtitle}</span>
                      <small>{categoryMeta[place.category].label}</small>
                    </div>
                    <div className={styles.placeActions}>
                      <button
                        type="button"
                        className={styles.placeAdd}
                        onClick={event => {
                          event.stopPropagation();
                          onAddToDay(place);
                        }}
                        aria-label={`Add ${place.name} to ${selectedDay?.label ?? 'your day'}`}
                        title="Add to day"
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={event => {
                          event.stopPropagation();
                          void onRemoveFromLocation(place, activeLocation);
                        }}
                        aria-label={`Remove ${place.name} from ${activeLocation.locationName}`}
                        title={`Remove from ${activeLocation.locationName}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </article>
                ))}
                {!locationPlaces.length && (
                  <div className={styles.noPlaces}>Add places from your trip library below.</div>
                )}
              </div>
            </div>
          </section>
        )}
        <section className={styles.availableSection} aria-labelledby="available-places-heading">
          <div className={styles.sectionHeading}>
            <span id="available-places-heading">
              {activeLocation && showLocationPlaces ? 'Add from saved places' : 'Available places'}
            </span>
            <strong>{availablePlaces.length}</strong>
          </div>
          {availablePlaces.map(place => (
            <article
              key={place.id}
              className={`${styles.placeCard} ${selectedPlaceId === place.id ? styles.placeCardSelected : ''}`}
              draggable
              onMouseEnter={() => setHoveredPlaceId(place.id)}
              onMouseLeave={() => setHoveredPlaceId(null)}
              onDragStart={event =>
                setTimelineDragPayload(event, { type: 'place', placeId: place.id })
              }
              onClick={() => onSelectPlace(place)}
            >
              <div
                className={styles.placeIcon}
                style={{ backgroundColor: `${place.color}18`, color: place.color }}
              >
                {place.emoji}
              </div>
              <div className={styles.placeInfo}>
                <strong>{place.name}</strong>
                <span>{place.subtitle}</span>
                <small>
                  <span style={{ color: place.color }}>{categoryMeta[place.category].label}</span>
                </small>
              </div>
              <div className={styles.placeActions}>
                <button
                  type="button"
                  className={`${styles.favoriteButton} ${place.isFavorite ? styles.favoriteActive : ''}`}
                  onClick={event => {
                    event.stopPropagation();
                    void onToggleFavorite(place);
                  }}
                  aria-pressed={place.isFavorite ?? false}
                  aria-label={`${place.isFavorite ? 'Remove' : 'Add'} ${place.name} ${place.isFavorite ? 'from' : 'to'} favorites`}
                  title={place.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star size={14} fill={place.isFavorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  className={styles.placeAdd}
                  onClick={event => {
                    event.stopPropagation();
                    if (activeLocation && showLocationPlaces) {
                      void onAddToLocation(place, activeLocation);
                    } else {
                      onAddToDay(place);
                    }
                  }}
                  aria-label={
                    activeLocation && showLocationPlaces
                      ? `Add ${place.name} to ${activeLocation.locationName}`
                      : `Add ${place.name} to ${selectedDay?.label ?? 'your trip'}`
                  }
                  title={
                    activeLocation && showLocationPlaces
                      ? `Add to ${activeLocation.locationName}`
                      : 'Add to day'
                  }
                >
                  <Plus size={15} />
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={event => {
                    event.stopPropagation();
                    if (window.confirm(`Delete “${place.name}” from saved places?`)) {
                      void onDeletePlace(place);
                    }
                  }}
                  aria-label={`Delete ${place.name}`}
                  title="Delete saved place"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
          {availablePlaces.length === 0 && (
            <div className={styles.noPlaces}>
              {activeLocation && showLocationPlaces
                ? 'Every matching saved place is already in this shortlist.'
                : places.length
                  ? filter === 'FAVORITES'
                    ? 'No favorite places yet.'
                    : scheduledPlaces.length
                      ? 'All matching places are already selected.'
                      : 'No places match that filter.'
                  : 'No saved places yet. Search Google Maps to add one.'}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
