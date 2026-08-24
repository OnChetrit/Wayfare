import { ArrowRight, Search, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import styles from './StayEditor.module.scss';
import type { StayDraft, StayEditorState } from './date-bar-types';
import type { SavedPlace } from './types';
import { currencyLabels, supportedCurrencies } from '@/lib/trips/currencies';

type StayEditorProps = {
  editor: StayEditorState;
  places: SavedPlace[];
  destinationLabel?: string | null;
  onSavePlace: (place: SavedPlace) => Promise<SavedPlace>;
  onChangeDraft: (next: Partial<StayDraft>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

export function StayEditor({
  editor,
  places,
  destinationLabel,
  onSavePlace,
  onChangeDraft,
  onClose,
  onSave,
  onDelete,
}: StayEditorProps) {
  const { draft } = editor;
  const [query, setQuery] = useState(draft.name);
  const [results, setResults] = useState<SavedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectingPlaceId, setSelectingPlaceId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const placeSearchRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    function closeSearch(event: PointerEvent) {
      if (!placeSearchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    }

    document.addEventListener('pointerdown', closeSearch);
    return () => document.removeEventListener('pointerdown', closeSearch);
  }, [searchOpen]);
  const localResults = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];
    return places
      .filter(place => place.category === 'HOTEL')
      .filter(place => `${place.name} ${place.subtitle}`.toLowerCase().includes(normalized))
      .slice(0, 4);
  }, [places, query]);
  const searchResults = useMemo(
    () =>
      [...results, ...localResults]
        .filter(
          (place, index, all) => all.findIndex(candidate => candidate.id === place.id) === index,
        )
        .filter(place => place.category === 'HOTEL')
        .slice(0, 6),
    [localResults, results],
  );

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
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
        if (!response.ok) throw new Error(payload.error ?? 'Google Maps search failed');
        setResults(payload.places ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setResults([]);
        setSearchError(error instanceof Error ? error.message : 'Google Maps search failed');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [destinationLabel, query]);

  async function selectPlace(place: SavedPlace) {
    setSelectingPlaceId(place.id);
    setSearchError('');
    setSearchOpen(false);
    setQuery(place.name);
    setResults([]);
    onChangeDraft({
      name: place.name,
      savedPlaceId: null,
      address: place.subtitle,
      locationLabel: destinationLabel ?? '',
    });
    try {
      const savedPlace = await onSavePlace(place);
      onChangeDraft({ savedPlaceId: savedPlace.id });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not save this hotel');
    } finally {
      setSelectingPlaceId(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.timelineEditor}
      aria-label="Stay editor"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className={styles.timelineEditorHeader}>
          <strong>{editor.stayId ? 'Edit stay' : 'Add stay'}</strong>
          <button
            type="button"
            className={styles.editorIconButton}
            onClick={onClose}
            aria-label="Close stay editor"
          >
            <X size={14} />
          </button>
        </div>
        <label className={styles.placeSearchField}>
          Search Google Maps
          <div
            ref={placeSearchRef}
            className={styles.placeSearch}
            aria-busy={searching || Boolean(selectingPlaceId)}
          >
            <Search size={14} />
            <input
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setResults([]);
                setSearchError('');
                setSearchOpen(true);
              }}
              placeholder={
                destinationLabel ? `Search hotels in ${destinationLabel}` : 'Search hotels'
              }
              aria-label="Search Google Maps for a hotel"
            />
            {query && (
              <button
                type="button"
                className={styles.clearPlaceSearch}
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setSearchOpen(false);
                }}
                aria-label="Clear hotel search"
              >
                <X size={13} />
              </button>
            )}
            {searchOpen && query.trim().length >= 2 && (searching || searchResults.length > 0) && (
              <div className={styles.placeSearchResults}>
                {searching && (
                  <div className={styles.placeSearchStatus}>Searching Google Maps…</div>
                )}
                {searchResults.map(place => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => void selectPlace(place)}
                    disabled={Boolean(selectingPlaceId)}
                  >
                    <span
                      className={styles.placeSearchEmoji}
                      style={{ backgroundColor: `${place.color}20`, color: place.color }}
                    >
                      {place.emoji}
                    </span>
                    <span>
                      <strong>{place.name}</strong>
                      <small>{place.subtitle}</small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
          {searchError && <small className={styles.placeSearchError}>{searchError}</small>}
        </label>
        <label>
          Stay name *
          <input
            autoFocus
            required
            value={draft.name}
            onChange={event => onChangeDraft({ name: event.target.value })}
          />
        </label>
        <div className={styles.editorTwoColumns}>
          <label>
            Check-in
            <input
              className="wayfareDateInput"
              type="date"
              value={draft.checkInDate}
              onChange={event => onChangeDraft({ checkInDate: event.target.value })}
            />
          </label>
          <label>
            Check-out
            <input
              className="wayfareDateInput"
              type="date"
              value={draft.checkOutDate}
              onChange={event => onChangeDraft({ checkOutDate: event.target.value })}
            />
          </label>
        </div>
        <div className={styles.editorTwoColumns}>
          <label>
            Address
            <input
              value={draft.address}
              onChange={event => onChangeDraft({ address: event.target.value })}
            />
          </label>
          <label>
            City / area
            <input
              value={draft.locationLabel}
              onChange={event => onChangeDraft({ locationLabel: event.target.value })}
            />
          </label>
        </div>
        <div className={styles.editorTwoColumns}>
          <label>
            Price
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.price}
              onChange={event => onChangeDraft({ price: event.target.value })}
              placeholder="0.00"
              inputMode="decimal"
            />
          </label>
          <label>
            Currency
            <select
              value={draft.priceCurrency}
              onChange={event => onChangeDraft({ priceCurrency: event.target.value })}
            >
              {supportedCurrencies.map(option => (
                <option key={option} value={option}>
                  {option} — {currencyLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.editorTwoColumns}>
          <label>
            Cancellation time
            <input
              value={draft.cancellationTime}
              onChange={event => onChangeDraft({ cancellationTime: event.target.value })}
              placeholder="18:00"
            />
          </label>
        </div>
        <div className={styles.editorTwoColumns}>
          <label>
            Confirmation number
            <input
              value={draft.confirmationNumber}
              onChange={event => onChangeDraft({ confirmationNumber: event.target.value })}
              placeholder="ABC123"
            />
          </label>
          <label>
            Secret code
            <input
              value={draft.secretCode}
              onChange={event => onChangeDraft({ secretCode: event.target.value })}
              placeholder="Door or access code"
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            rows={2}
            value={draft.notes}
            onChange={event => onChangeDraft({ notes: event.target.value })}
          />
        </label>
        <div className={styles.timelineEditorActions}>
          {onDelete && (
            <button type="button" className={styles.editorDeleteButton} onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="button" className={styles.editorCancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={styles.editorSaveButton}
            disabled={Boolean(selectingPlaceId)}
          >
            Save stay
          </button>
        </div>
      </form>
    </dialog>
  );
}
