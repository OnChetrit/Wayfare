import type { CSSProperties } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './DateStrip.module.scss';
import { isTimelinePlaceDrag, parseTimelineDragPayload } from './timeline-dnd';
import type { LocationSegment, SavedPlace, ScheduleItem, TripDay } from './types';

export type DateStripHandle = {
  scrollByDay: (direction: -1 | 1) => void;
};

type DateStripProps = {
  days: TripDay[];
  selectedDate: string | null;
  locationSegments: LocationSegment[];
  selectedLocationId: string | null;
  schedule: ScheduleItem[];
  places: SavedPlace[];
  onSelectDay: (date: string) => void;
  onSelectLocation: (location: LocationSegment) => void;
  onAddPlaceToLocation: (place: SavedPlace, location: LocationSegment) => void;
  onMoveActivity: (itemId: string, date: string) => void;
  onAddPlaceToDay: (place: SavedPlace, date: string) => void;
  onScrollStateChange?: (state: { canScrollPrevious: boolean; canScrollNext: boolean }) => void;
};

export const DateStrip = forwardRef<DateStripHandle, DateStripProps>(function DateStrip(
  {
    days,
    selectedDate,
    locationSegments,
    selectedLocationId,
    schedule,
    places,
    onSelectDay,
    onSelectLocation,
    onAddPlaceToLocation,
    onMoveActivity,
    onAddPlaceToDay,
    onScrollStateChange,
  },
  ref,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverLocationId, setDragOverLocationId] = useState<string | null>(null);
  const scheduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    schedule.forEach(item => counts.set(item.date, (counts.get(item.date) ?? 0) + 1));
    return counts;
  }, [schedule]);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !onScrollStateChange) return;

    onScrollStateChange({
      canScrollPrevious: scroller.scrollLeft > 1,
      canScrollNext: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1,
    });
  }, [onScrollStateChange]);

  const scrollToDate = useCallback((date: string, behavior: ScrollBehavior = 'smooth') => {
    const scroller = scrollerRef.current;
    const card = scroller?.querySelector<HTMLElement>(`[data-date-card="${date}"]`);
    if (!scroller || !card) return;

    const cardStart = card.offsetLeft;
    const cardEnd = cardStart + card.offsetWidth;
    const visibleStart = scroller.scrollLeft;
    const visibleEnd = visibleStart + scroller.clientWidth;
    if (cardStart >= visibleStart && cardEnd <= visibleEnd) return;

    const nextScrollLeft = cardStart < visibleStart ? cardStart : cardEnd - scroller.clientWidth;
    scroller.scrollTo({ left: nextScrollLeft, behavior });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollByDay(direction) {
        const scroller = scrollerRef.current;
        const card = scroller?.querySelector<HTMLElement>('[data-date-card]');
        if (!scroller) return;

        const dayWidth = card ? card.offsetWidth + 9 : scroller.clientWidth;
        scroller.scrollBy({ left: direction * dayWidth, behavior: 'smooth' });
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    if (selectedDate) scrollToDate(selectedDate, 'auto');
    updateScrollState();
  }, [days.length, selectedDate, scrollToDate, updateScrollState]);

  useEffect(() => {
    function clearDragOver() {
      setDragOverDate(null);
      setDragOverLocationId(null);
    }

    window.addEventListener('dragend', clearDragOver);
    window.addEventListener('drop', clearDragOver);
    return () => {
      window.removeEventListener('dragend', clearDragOver);
      window.removeEventListener('drop', clearDragOver);
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scroller);
    scroller.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();

    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener('scroll', updateScrollState);
    };
  }, [updateScrollState]);

  if (!days.length) {
    return <div className={styles.noTripDates}>Create a trip to start adding days</div>;
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;
    if (!scroller || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    event.preventDefault();
    scroller.scrollBy({ left: event.deltaY, behavior: 'auto' });
  }

  function handleDrop(event: React.DragEvent<HTMLElement>, date: string) {
    event.preventDefault();
    event.stopPropagation();
    const payload = parseTimelineDragPayload(event);
    setDragOverDate(null);
    if (!payload) return;

    if (payload.type === 'activity') {
      onMoveActivity(payload.itemId, date);
      return;
    }

    const place = places.find(item => item.id === payload.placeId);
    if (place) onAddPlaceToDay(place, date);
  }

  function handleLocationDrop(event: React.DragEvent<HTMLElement>, location: LocationSegment) {
    event.preventDefault();
    event.stopPropagation();
    setDragOverLocationId(null);
    const payload = parseTimelineDragPayload(event);
    if (!payload || payload.type !== 'place') return;
    const place = places.find(item => item.id === payload.placeId);
    if (place) onAddPlaceToLocation(place, location);
  }

  return (
    <div className={styles.dateScroller} ref={scrollerRef} onWheel={handleWheel}>
      <div
        className={styles.stripContent}
        style={
          {
            '--trip-day-count': days.length,
            '--trip-strip-min-width': `${days.length * 92 + Math.max(0, days.length - 1) * 9}px`,
            '--trip-location-grid-template': days
              .flatMap((_, index) =>
                index === days.length - 1
                  ? ['minmax(0, 1fr)', 'minmax(0, 1fr)']
                  : ['minmax(0, 1fr)', 'minmax(0, 1fr)', '9px'],
              )
              .join(' '),
          } as CSSProperties
        }
      >
        <div className={styles.locationRow} aria-label="Trip locations">
          {locationSegments.map(location => {
            const startIndex = days.findIndex(day => day.date === location.startDate);
            const endIndex = days.findIndex(day => day.date === location.endDate);
            if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) return null;
            const startMidpointLine = startIndex * 3 + 2;
            const endMidpointLine = endIndex * 3 + 2;
            return (
              <button
                key={location.id}
                type="button"
                className={`${selectedLocationId === location.id ? styles.locationCardActive : ''} ${dragOverLocationId === location.id ? styles.locationCardDropTarget : ''}`}
                style={
                  {
                    gridColumn: `${startMidpointLine} / ${endMidpointLine}`,
                  } as CSSProperties
                }
                onClick={() => onSelectLocation(location)}
                onDragOver={event => {
                  if (!isTimelinePlaceDrag(event)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                  setDragOverLocationId(location.id);
                }}
                onDragLeave={event => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDragOverLocationId(null);
                  }
                }}
                onDrop={event => handleLocationDrop(event, location)}
                aria-pressed={selectedLocationId === location.id}
              >
                <span>{location.locationName}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.daysRow}>
          {days.map(day => {
            const isSelected = selectedDate === day.date;
            const isDropTarget = dragOverDate === day.date;
            const count = scheduleCounts.get(day.date) ?? 0;
            return (
              <button
                type="button"
                key={day.date}
                data-date-card={day.date}
                className={`${styles.dateCard} ${isSelected ? styles.dateCardActive : ''} ${isDropTarget ? styles.dateCardDropTarget : ''}`}
                onClick={() => onSelectDay(day.date)}
                onDragOver={event => {
                  event.preventDefault();
                  setDragOverDate(day.date);
                }}
                onDragLeave={event => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDragOverDate(null);
                  }
                }}
                onDrop={event => handleDrop(event, day.date)}
                aria-pressed={isSelected}
              >
                <span>{day.weekday}</span>
                <strong>{day.date.slice(-2)}</strong>
                <small>{count ? count : ''}</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
