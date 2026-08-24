import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { startTransition, useEffect, useOptimistic, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import styles from './DateBar.module.scss';
import { DateStrip, type DateStripHandle } from './DateStrip';
import { ExpandedTimeline } from './ExpandedTimeline';
import { addDays, dateDifference } from './date-bar-utils';
import type {
  LocationDraft,
  LocationEditorState,
  StayDraft,
  StayEditorState,
  SavePlace,
  LocationItemDragState,
  StayDragState,
  TimelineDragState,
} from './date-bar-types';
import type { LocationSegment, SavedPlace, ScheduleItem, Stay, TripDay } from './types';

export type { LocationDraft, StayDraft } from './date-bar-types';

type DateBarProps = {
  days: TripDay[];
  selectedDate: string;
  selectedLocationId: string | null;
  schedule: ScheduleItem[];
  locationSegments: LocationSegment[];
  stays: Stay[];
  places: SavedPlace[];
  destinationLabel?: string | null;
  defaultCurrency: string;
  onSavePlace: SavePlace;
  onSelectDay: (date: string) => void;
  onSelectLocation: (location: LocationSegment) => void;
  onAddPlaceToLocation: (place: SavedPlace, location: LocationSegment) => void;
  onMoveActivity: (itemId: string, date: string) => void;
  onAddPlaceToDay: (place: SavedPlace, date: string) => void;
  onAddLocation: (
    sourceSegmentId: string,
    splitDate: string,
    draft: LocationDraft,
  ) => Promise<void>;
  onCreateLocationDivision: (
    startDate: string,
    endDate: string,
    draft: LocationDraft,
  ) => Promise<void>;
  onUpdateLocation: (segmentId: string, draft: LocationDraft) => Promise<void>;
  onDeleteLocation: (segmentId: string, neighborSegmentId?: string) => Promise<void>;
  onMoveBoundary: (
    leftSegmentId: string,
    rightSegmentId: string,
    newBoundary: string,
  ) => Promise<void>;
  onMoveSharedBoundary: (
    leftSegmentId: string,
    rightSegmentId: string,
    stayId: string,
    newBoundary: string,
  ) => Promise<void>;
  onCreateStay: (draft: StayDraft) => Promise<void>;
  onUpdateStay: (stayId: string, draft: StayDraft) => Promise<void>;
  onMoveStayDates: (stayId: string, checkInDate: string, checkOutDate: string) => Promise<void>;
  onDeleteStay: (stayId: string) => Promise<void>;
};

function defaultLocationDraft(segment?: LocationSegment): LocationDraft {
  return {
    locationName: segment?.locationName ?? '',
    startDate: segment?.startDate,
    endDate: segment?.endDate,
  };
}

function defaultStayDraft(
  stay: Stay | undefined,
  firstNight: string | undefined,
  lastDate: string | undefined,
  defaultCurrency: string,
): StayDraft {
  return {
    name: stay?.name ?? '',
    savedPlaceId: stay?.savedPlaceId ?? null,
    checkInDate: stay?.checkInDate ?? firstNight ?? '',
    checkOutDate: stay?.checkOutDate ?? lastDate ?? (firstNight ? addDays(firstNight, 1) : ''),
    address: stay?.address ?? '',
    locationLabel: stay?.locationLabel ?? '',
    price: stay?.price ?? '',
    priceCurrency: stay?.priceCurrency ?? defaultCurrency,
    cancellationTime: stay?.cancellationTime ?? '',
    confirmationNumber: stay?.confirmationNumber ?? '',
    secretCode: stay?.secretCode ?? '',
    notes: stay?.notes ?? '',
  };
}

export function DateBar({
  days,
  selectedDate,
  selectedLocationId,
  schedule,
  locationSegments,
  stays,
  places,
  destinationLabel,
  defaultCurrency,
  onSavePlace,
  onSelectDay,
  onSelectLocation,
  onAddPlaceToLocation,
  onMoveActivity,
  onAddPlaceToDay,
  onAddLocation,
  onCreateLocationDivision,
  onUpdateLocation,
  onDeleteLocation,
  onMoveBoundary,
  onMoveSharedBoundary,
  onCreateStay,
  onUpdateStay,
  onMoveStayDates,
  onDeleteStay,
}: DateBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [optimisticSelectedDate, setOptimisticSelectedDate] = useOptimistic(
    selectedDate,
    (_currentDate, nextDate: string) => nextDate,
  );
  const [locationEditor, setLocationEditor] = useState<LocationEditorState | null>(null);
  const [stayEditor, setStayEditor] = useState<StayEditorState | null>(null);
  const [previewSegments, setPreviewSegments] = useState<LocationSegment[] | null>(null);
  const [drag, setDrag] = useState<TimelineDragState | null>(null);
  const [stayDrag, setStayDrag] = useState<StayDragState | null>(null);
  const [locationItemDrag, setLocationItemDrag] = useState<LocationItemDragState | null>(null);
  const [previewStays, setPreviewStays] = useState<Stay[] | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);
  const [dateRangeDrag, setDateRangeDrag] = useState<{ start: string; end: string } | null>(null);
  const [rangeTrack, setRangeTrack] = useState<'location' | 'stay' | null>(null);
  const [rangeMoved, setRangeMoved] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<TimelineDragState | null>(null);
  const stayDragRef = useRef<StayDragState | null>(null);
  const locationItemDragRef = useRef<LocationItemDragState | null>(null);
  const suppressItemClickRef = useRef(false);
  const dateStripRef = useRef<DateStripHandle>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const wasExpandedRef = useRef(expanded);
  const [stripScrollState, setStripScrollState] = useState({
    canScrollPrevious: false,
    canScrollNext: false,
  });
  const effectiveSegments = previewSegments ?? locationSegments;
  const effectiveStays = previewStays ?? stays;
  const firstDate = days[0]?.date ?? '';
  const lastDate = days[days.length - 1]?.date ?? '';
  const firstNight = firstDate && firstDate < lastDate ? firstDate : '';
  const rawVisibleRange = dateRangeDrag ?? selectedRange;
  const visibleRange =
    rawVisibleRange && rawVisibleRange.start > rawVisibleRange.end
      ? { start: rawVisibleRange.end, end: rawVisibleRange.start }
      : rawVisibleRange;

  function getTimelinePointerDate(clientX: number, clientY: number) {
    const weekElement = Array.from(
      timelineRef.current?.querySelectorAll<HTMLElement>('[data-timeline-week]') ?? [],
    ).find(element => {
      const rect = element.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!weekElement) return null;
    const dateCells = Array.from(
      weekElement.querySelectorAll<HTMLElement>('[data-timeline-column-date]'),
    );
    const dateCell = dateCells.reduce<HTMLElement | undefined>((closest, candidate) => {
      if (!closest) return candidate;
      const closestRect = closest.getBoundingClientRect();
      const candidateRect = candidate.getBoundingClientRect();
      const closestDistance = Math.abs(clientX - (closestRect.left + closestRect.width / 2));
      const candidateDistance = Math.abs(clientX - (candidateRect.left + candidateRect.width / 2));
      return candidateDistance < closestDistance ? candidate : closest;
    }, undefined);
    if (!dateCell?.dataset.timelineColumnDate) return null;
    const rect = dateCell.getBoundingClientRect();
    const date = dateCell.dataset.timelineColumnDate;
    return clientX < rect.left + rect.width / 2 ? date : addDays(date, 1);
  }

  function suppressNextItemClick() {
    suppressItemClickRef.current = true;
    window.setTimeout(() => {
      suppressItemClickRef.current = false;
    }, 0);
  }

  function shouldOpenTimelineItem() {
    if (!suppressItemClickRef.current) return true;
    suppressItemClickRef.current = false;
    return false;
  }

  function animateSnap(element: HTMLElement, visualLeft: number) {
    element.style.transition = 'none';
    element.style.transform = 'none';
    element.style.width = '';
    const snappedLeft = element.getBoundingClientRect().left;
    element.style.transform = `translate3d(${visualLeft - snappedLeft}px, 0, 0)`;
    window.requestAnimationFrame(() => {
      element.style.transition = 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      element.style.transform = 'translate3d(0, 0, 0)';
      window.setTimeout(() => {
        element.style.transition = '';
        element.style.transform = '';
        element.style.width = '';
      }, 190);
    });
  }

  function returnToAnchor(element: HTMLElement) {
    element.style.transition = 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    element.style.transform = 'translate3d(0, 0, 0)';
    window.setTimeout(() => {
      element.style.transition = '';
      element.style.transform = '';
    }, 190);
  }

  function getMagneticOffset(
    clientX: number,
    clientY: number,
    edgeX: number,
    currentSnapOffset: number | null,
  ) {
    const weekElement = Array.from(
      timelineRef.current?.querySelectorAll<HTMLElement>('[data-timeline-week]') ?? [],
    ).find(element => {
      const rect = element.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!weekElement) return null;
    const anchors = Array.from(
      weekElement.querySelectorAll<HTMLElement>('[data-timeline-column-date]'),
    ).flatMap(cell => {
      const date = cell.dataset.timelineColumnDate;
      if (!date) return [];
      const rect = cell.getBoundingClientRect();
      return [rect.left, rect.left + rect.width];
    });
    const nearest = anchors.reduce<number | null>((closest, anchor) => {
      if (closest == null || Math.abs(anchor - edgeX) < Math.abs(closest - edgeX)) return anchor;
      return closest;
    }, null);
    if (nearest == null) return null;
    const distance = nearest - edgeX;
    const threshold = currentSnapOffset == null ? 14 : 22;
    return Math.abs(distance) <= threshold ? clientX + distance : null;
  }

  useEffect(() => {
    if (!expanded && wasExpandedRef.current) {
      expandButtonRef.current?.focus();
    }
    wasExpandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const frame = window.requestAnimationFrame(() => {
      timelineRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setExpanded(false);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);

  useEffect(() => {
    if (!dragRef.current) return;
    function onPointerMove(event: PointerEvent) {
      const currentDrag = dragRef.current;
      if (!currentDrag) return;
      if (Math.abs(event.clientX - currentDrag.pointerStartX) > 4)
        suppressItemClickRef.current = true;
      const edgeX = currentDrag.leftBand.getBoundingClientRect().right;
      const snappedClientX = getMagneticOffset(
        event.clientX,
        event.clientY,
        edgeX,
        currentDrag.snapOffsetX,
      );
      const offset = (snappedClientX ?? event.clientX) - currentDrag.pointerStartX;
      currentDrag.snapOffsetX = snappedClientX == null ? null : offset;
      currentDrag.leftBand.style.transition = 'none';
      currentDrag.rightBand.style.transition = 'none';
      currentDrag.leftBand.style.width = `${Math.max(16, currentDrag.leftWidth + offset)}px`;
      currentDrag.rightBand.style.transform = `translate3d(${offset}px, 0, 0)`;
      currentDrag.rightBand.style.width = `${Math.max(16, currentDrag.rightWidth - offset)}px`;
      if (currentDrag.sharedStayBand && currentDrag.sharedStayWidth) {
        currentDrag.sharedStayBand.style.transition = 'none';
        currentDrag.sharedStayBand.style.width = `${Math.max(16, currentDrag.sharedStayWidth + offset)}px`;
      }
    }
    async function onPointerUp(event: PointerEvent) {
      const currentDrag = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      const candidate = getTimelinePointerDate(event.clientX, event.clientY);
      if (currentDrag && candidate) {
        const minimum = addDays(currentDrag.left.startDate, 1);
        const sharedStay = currentDrag.sharedStay;
        const nextStayStart = sharedStay
          ? stays
              .filter(
                stay => stay.id !== sharedStay.id && stay.checkInDate >= sharedStay.checkOutDate,
              )
              .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))[0]?.checkInDate
          : undefined;
        const locationMaximum = addDays(currentDrag.right.endDate, -1);
        const maximum =
          nextStayStart && nextStayStart < locationMaximum ? nextStayStart : locationMaximum;
        const boundary = candidate < minimum ? minimum : candidate > maximum ? maximum : candidate;
        const leftVisualLeft = currentDrag.leftBand.getBoundingClientRect().left;
        const rightVisualLeft = currentDrag.rightBand.getBoundingClientRect().left;
        const stayVisualLeft = currentDrag.sharedStayBand?.getBoundingClientRect().left;
        flushSync(() => {
          setPreviewSegments(
            locationSegments.map(segment =>
              segment.id === currentDrag.left.id
                ? { ...segment, endDate: boundary }
                : segment.id === currentDrag.right.id
                  ? { ...segment, startDate: boundary }
                  : segment,
            ),
          );
          if (currentDrag.sharedStay) {
            setPreviewStays(
              stays.map(stay =>
                stay.id === currentDrag.sharedStay?.id ? { ...stay, checkOutDate: boundary } : stay,
              ),
            );
          }
        });
        animateSnap(currentDrag.leftBand, leftVisualLeft);
        animateSnap(currentDrag.rightBand, rightVisualLeft);
        if (currentDrag.sharedStayBand && stayVisualLeft != null) {
          animateSnap(currentDrag.sharedStayBand, stayVisualLeft);
        }
        if (boundary !== currentDrag.originalBoundary) {
          if (currentDrag.sharedStay) {
            await onMoveSharedBoundary(
              currentDrag.left.id,
              currentDrag.right.id,
              currentDrag.sharedStay.id,
              boundary,
            );
          } else {
            await onMoveBoundary(currentDrag.left.id, currentDrag.right.id, boundary);
          }
        }
      } else if (currentDrag) {
        returnToAnchor(currentDrag.leftBand);
        returnToAnchor(currentDrag.rightBand);
        if (currentDrag.sharedStayBand) returnToAnchor(currentDrag.sharedStayBand);
      }
      setPreviewSegments(null);
      setPreviewStays(null);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [
    drag?.left.id,
    drag?.right.id,
    locationSegments,
    onMoveBoundary,
    onMoveSharedBoundary,
    stays,
  ]);

  useEffect(() => {
    if (!stayDragRef.current) return;

    function onPointerMove(event: PointerEvent) {
      const currentDrag = stayDragRef.current;
      if (!currentDrag) return;
      if (Math.abs(event.clientX - currentDrag.pointerStartX) > 4)
        suppressItemClickRef.current = true;
      const edgeX =
        currentDrag.edge === 'checkOut'
          ? currentDrag.bandElement.getBoundingClientRect().right
          : currentDrag.bandElement.getBoundingClientRect().left;
      const snappedClientX = getMagneticOffset(
        event.clientX,
        event.clientY,
        edgeX,
        currentDrag.snapOffsetX,
      );
      const offset = (snappedClientX ?? event.clientX) - currentDrag.pointerStartX;
      currentDrag.snapOffsetX = snappedClientX == null ? null : offset;
      currentDrag.bandElement.style.transition = 'none';
      if (currentDrag.edge === 'checkIn') {
        currentDrag.bandElement.style.transform = `translate3d(${offset}px, 0, 0)`;
        currentDrag.bandElement.style.width = `${Math.max(16, currentDrag.bandWidth - offset)}px`;
      } else if (currentDrag.edge === 'checkOut') {
        currentDrag.bandElement.style.width = `${Math.max(16, currentDrag.bandWidth + offset)}px`;
      } else {
        currentDrag.bandElement.style.transform = `translate3d(${offset}px, 0, 0)`;
      }
    }

    async function onPointerUp(event: PointerEvent) {
      const currentDrag = stayDragRef.current;
      stayDragRef.current = null;
      setStayDrag(null);
      const candidate = getTimelinePointerDate(event.clientX, event.clientY);
      if (!currentDrag || !candidate) {
        if (currentDrag) {
          returnToAnchor(currentDrag.bandElement);
        }
        setPreviewStays(null);
        return;
      }
      const stayNights = dateDifference(
        currentDrag.stay.checkInDate,
        currentDrag.stay.checkOutDate,
      );
      const proposedDate =
        currentDrag.edge === 'move' ? addDays(candidate, -currentDrag.offsetDays) : candidate;
      const ordered = [...stays].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
      const index = ordered.findIndex(stay => stay.id === currentDrag.stay.id);
      const previous = ordered[index - 1];
      const next = ordered[index + 1];
      const minimum =
        currentDrag.edge === 'checkIn'
          ? (previous?.checkOutDate ?? firstDate)
          : currentDrag.edge === 'checkOut'
            ? addDays(currentDrag.stay.checkInDate, 1)
            : (previous?.checkOutDate ?? firstDate);
      const maximum =
        currentDrag.edge === 'checkIn'
          ? addDays(currentDrag.stay.checkOutDate, -1)
          : currentDrag.edge === 'checkOut'
            ? (next?.checkInDate ?? lastDate)
            : addDays(next?.checkInDate ?? lastDate, -stayNights);
      const nextDate =
        proposedDate < minimum ? minimum : proposedDate > maximum ? maximum : proposedDate;
      const checkInDate = currentDrag.edge === 'checkOut' ? currentDrag.stay.checkInDate : nextDate;
      const checkOutDate =
        currentDrag.edge === 'checkIn'
          ? currentDrag.stay.checkOutDate
          : currentDrag.edge === 'checkOut'
            ? nextDate
            : addDays(nextDate, stayNights);
      const visualLeft = currentDrag.bandElement.getBoundingClientRect().left;
      flushSync(() => {
        setPreviewStays(
          stays.map(stay =>
            stay.id !== currentDrag.stay.id ? stay : { ...stay, checkInDate, checkOutDate },
          ),
        );
      });
      animateSnap(currentDrag.bandElement, visualLeft);
      if (
        checkInDate !== currentDrag.stay.checkInDate ||
        checkOutDate !== currentDrag.stay.checkOutDate
      ) {
        await onMoveStayDates(currentDrag.stay.id, checkInDate, checkOutDate);
      }
      setPreviewStays(null);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [firstDate, lastDate, onMoveStayDates, stayDrag?.stay.id, stays]);

  useEffect(() => {
    if (!locationItemDragRef.current) return;

    function onPointerMove(event: PointerEvent) {
      const currentDrag = locationItemDragRef.current;
      if (!currentDrag) return;
      if (Math.abs(event.clientX - currentDrag.pointerStartX) > 4)
        suppressItemClickRef.current = true;
      const edgeX =
        currentDrag.edge === 'end'
          ? currentDrag.bandElement.getBoundingClientRect().right
          : currentDrag.bandElement.getBoundingClientRect().left;
      const snappedClientX = getMagneticOffset(
        event.clientX,
        event.clientY,
        edgeX,
        currentDrag.snapOffsetX,
      );
      const offset = (snappedClientX ?? event.clientX) - currentDrag.pointerStartX;
      currentDrag.snapOffsetX = snappedClientX == null ? null : offset;
      currentDrag.bandElement.style.transition = 'none';
      if (currentDrag.edge === 'start') {
        currentDrag.bandElement.style.transform = `translate3d(${offset}px, 0, 0)`;
        currentDrag.bandElement.style.width = `${Math.max(16, currentDrag.bandWidth - offset)}px`;
      } else if (currentDrag.edge === 'end') {
        currentDrag.bandElement.style.width = `${Math.max(16, currentDrag.bandWidth + offset)}px`;
      } else {
        currentDrag.bandElement.style.transform = `translate3d(${offset}px, 0, 0)`;
      }
    }

    async function onPointerUp(event: PointerEvent) {
      const currentDrag = locationItemDragRef.current;
      locationItemDragRef.current = null;
      setLocationItemDrag(null);
      const candidate = getTimelinePointerDate(event.clientX, event.clientY);
      if (!currentDrag || !candidate) {
        if (currentDrag) returnToAnchor(currentDrag.bandElement);
        return;
      }
      const ordered = [...locationSegments].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const index = ordered.findIndex(segment => segment.id === currentDrag.segment.id);
      const previous = ordered[index - 1];
      const next = ordered[index + 1];
      const nights = dateDifference(currentDrag.segment.startDate, currentDrag.segment.endDate);
      const proposedStart =
        currentDrag.edge === 'move' ? addDays(candidate, -currentDrag.offsetDays) : candidate;
      const minStart = previous ? previous.endDate : firstDate;
      const maxEnd = next ? next.startDate : lastDate;
      let startDate = currentDrag.segment.startDate;
      let endDate = currentDrag.segment.endDate;
      if (currentDrag.edge === 'start') {
        startDate = proposedStart < minStart ? minStart : proposedStart;
        if (startDate >= endDate) startDate = addDays(endDate, -1);
      } else if (currentDrag.edge === 'end') {
        endDate = proposedStart > maxEnd ? maxEnd : proposedStart;
        if (endDate <= startDate) endDate = addDays(startDate, 1);
      } else {
        const maxStart = addDays(maxEnd, -nights);
        startDate =
          proposedStart < minStart ? minStart : proposedStart > maxStart ? maxStart : proposedStart;
        endDate = addDays(startDate, nights);
      }
      const visualLeft = currentDrag.bandElement.getBoundingClientRect().left;
      flushSync(() => {
        setPreviewSegments(
          locationSegments.map(segment =>
            segment.id === currentDrag.segment.id ? { ...segment, startDate, endDate } : segment,
          ),
        );
      });
      animateSnap(currentDrag.bandElement, visualLeft);
      if (startDate !== currentDrag.segment.startDate || endDate !== currentDrag.segment.endDate) {
        await onUpdateLocation(currentDrag.segment.id, {
          ...defaultLocationDraft(currentDrag.segment),
          startDate,
          endDate,
        });
      }
      setPreviewSegments(null);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [firstDate, lastDate, locationItemDrag?.segment.id, locationSegments, onUpdateLocation]);

  useEffect(() => {
    if (!dateRangeDrag) return;
    const currentDateRangeDrag = dateRangeDrag;
    function finishDateRange() {
      const start =
        currentDateRangeDrag.start < currentDateRangeDrag.end
          ? currentDateRangeDrag.start
          : currentDateRangeDrag.end;
      const end =
        currentDateRangeDrag.start < currentDateRangeDrag.end
          ? currentDateRangeDrag.end
          : currentDateRangeDrag.start;
      setSelectedRange(rangeMoved ? { start, end } : null);
      setDateRangeDrag(null);
      if (rangeMoved && rangeTrack) {
        // A location range is check-in through check-out. The final date reached
        // while dragging is the check-out date, not another overnight stay.
        if (rangeTrack === 'location') openLocationRangeEditor(start, end);
        else {
          setSelectedRange(null);
          setStayEditor({
            draft: defaultStayDraft(undefined, start, addDays(end, 1), defaultCurrency),
          });
        }
      }
      setRangeTrack(null);
    }
    window.addEventListener('pointerup', finishDateRange, { once: true });
    return () => window.removeEventListener('pointerup', finishDateRange);
  }, [dateRangeDrag, defaultCurrency, rangeMoved, rangeTrack]);

  function moveWindow(direction: -1 | 1) {
    if (expanded) {
      const scroller = timelineRef.current;
      const weeks = Array.from(
        scroller?.querySelectorAll<HTMLElement>('[data-timeline-week]') ?? [],
      );
      if (!scroller || !weeks.length) return;

      const threshold = scroller.scrollTop + (direction === 1 ? 24 : -24);
      const nextWeek =
        direction === 1
          ? (weeks.find(week => week.offsetTop > threshold) ?? weeks.at(-1))
          : ([...weeks].reverse().find(week => week.offsetTop < threshold) ?? weeks[0]);

      if (nextWeek) {
        scroller.scrollTo({ top: Math.max(0, nextWeek.offsetTop - 4), behavior: 'smooth' });
      }
      return;
    }
    dateStripRef.current?.scrollByDay(direction);
  }

  function selectDay(date: string) {
    setSelectedRange(date >= firstDate && date < lastDate ? { start: date, end: date } : null);
    startTransition(() => {
      setOptimisticSelectedDate(date);
      onSelectDay(date);
    });
  }

  function toggleExpanded() {
    setExpanded(open => !open);
  }

  function startDateRange(
    event: React.PointerEvent,
    date: string,
    track: 'location' | 'stay' | null = null,
  ) {
    if (event.button !== 0) return;
    setRangeMoved(false);
    setRangeTrack(track);
    setDateRangeDrag({ start: date, end: date });
  }

  function updateDateRange(date: string) {
    if (!dateRangeDrag) return;
    if (date !== dateRangeDrag.start) setRangeMoved(true);
    setDateRangeDrag(current => (current ? { ...current, end: date } : current));
  }

  function startBoundaryDrag(
    event: React.PointerEvent,
    left: LocationSegment,
    right: LocationSegment,
  ) {
    event.preventDefault();
    suppressNextItemClick();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const weekElement = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      '[data-timeline-week]',
    );
    const bands = Array.from(
      weekElement?.querySelectorAll<HTMLElement>('[data-location-band-id]') ?? [],
    );
    const leftBand = bands.find(band => band.dataset.locationBandId === left.id);
    const rightBand = bands.find(band => band.dataset.locationBandId === right.id);
    if (!leftBand || !rightBand) return;
    const nextDrag = {
      left,
      right,
      originalBoundary: left.endDate,
      boundary: left.endDate,
      pointerStartX: event.clientX,
      dragElement: event.currentTarget as HTMLElement,
      leftBand,
      rightBand,
      leftWidth: leftBand.getBoundingClientRect().width,
      rightWidth: rightBand.getBoundingClientRect().width,
      snapOffsetX: null,
    };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function startSharedBoundaryDrag(
    event: React.PointerEvent,
    left: LocationSegment,
    right: LocationSegment,
    stay: Stay,
  ) {
    event.preventDefault();
    suppressNextItemClick();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const weekElement = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      '[data-timeline-week]',
    );
    const locationBands = Array.from(
      weekElement?.querySelectorAll<HTMLElement>('[data-location-band-id]') ?? [],
    );
    const leftBand = locationBands.find(band => band.dataset.locationBandId === left.id);
    const rightBand = locationBands.find(band => band.dataset.locationBandId === right.id);
    const stayBand = Array.from(
      weekElement?.querySelectorAll<HTMLElement>('[data-stay-band-id]') ?? [],
    ).find(band => band.dataset.stayBandId === stay.id);
    if (!leftBand || !rightBand || !stayBand) return;
    const nextDrag = {
      left,
      right,
      originalBoundary: left.endDate,
      boundary: left.endDate,
      pointerStartX: event.clientX,
      dragElement: event.currentTarget as HTMLElement,
      leftBand,
      rightBand,
      leftWidth: leftBand.getBoundingClientRect().width,
      rightWidth: rightBand.getBoundingClientRect().width,
      snapOffsetX: null,
      sharedStay: stay,
      sharedStayBand: stayBand,
      sharedStayWidth: stayBand.getBoundingClientRect().width,
    } satisfies TimelineDragState;
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function startLocationEdgeDrag(
    event: React.PointerEvent,
    segment: LocationSegment,
    edge: Exclude<LocationItemDragState['edge'], 'move'>,
  ) {
    event.preventDefault();
    suppressNextItemClick();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const bandElement = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      '[data-location-band-id]',
    );
    if (!bandElement) return;
    const nextDrag = {
      segment,
      edge,
      originalDate: edge === 'start' ? segment.startDate : segment.endDate,
      offsetDays: 0,
      pointerStartX: event.clientX,
      bandElement,
      bandWidth: bandElement.getBoundingClientRect().width,
      snapOffsetX: null,
    } satisfies LocationItemDragState;
    locationItemDragRef.current = nextDrag;
    setLocationItemDrag(nextDrag);
  }

  function startLocationMove(event: React.PointerEvent, segment: LocationSegment) {
    if (event.button !== 0) return;
    event.preventDefault();
    const bandElement = event.currentTarget as HTMLElement;
    const pointerDate = getTimelinePointerDate(event.clientX, event.clientY);
    if (!pointerDate) return;
    const nextDrag = {
      segment,
      edge: 'move',
      originalDate: segment.startDate,
      offsetDays: dateDifference(segment.startDate, pointerDate),
      pointerStartX: event.clientX,
      bandElement,
      bandWidth: bandElement.getBoundingClientRect().width,
      snapOffsetX: null,
    } satisfies LocationItemDragState;
    locationItemDragRef.current = nextDrag;
    setLocationItemDrag(nextDrag);
  }

  function moveLocationEdgeWithKeyboard(
    event: React.KeyboardEvent,
    segment: LocationSegment,
    edge: Exclude<LocationItemDragState['edge'], 'move'>,
  ) {
    const currentDate = edge === 'start' ? segment.startDate : segment.endDate;
    let nextDate = currentDate;
    if (event.key === 'ArrowLeft') nextDate = addDays(currentDate, -1);
    if (event.key === 'ArrowRight') nextDate = addDays(currentDate, 1);
    if (nextDate === currentDate) return;
    event.preventDefault();
    const ordered = [...locationSegments].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const index = ordered.findIndex(item => item.id === segment.id);
    const minimum =
      edge === 'start' ? (ordered[index - 1]?.endDate ?? firstDate) : addDays(segment.startDate, 1);
    const maximum =
      edge === 'end' ? (ordered[index + 1]?.startDate ?? lastDate) : addDays(segment.endDate, -1);
    const date = nextDate < minimum ? minimum : nextDate > maximum ? maximum : nextDate;
    void onUpdateLocation(segment.id, {
      ...defaultLocationDraft(segment),
      ...(edge === 'start' ? { startDate: date } : { endDate: date }),
    });
  }

  function moveBoundaryWithKeyboard(
    event: React.KeyboardEvent,
    left: LocationSegment,
    right: LocationSegment,
  ) {
    let next = left.endDate;
    if (event.key === 'ArrowLeft') next = addDays(left.endDate, -1);
    if (event.key === 'ArrowRight') next = addDays(left.endDate, 1);
    if (event.key === 'Home') next = addDays(left.startDate, 1);
    if (event.key === 'End') next = addDays(right.endDate, -1);
    if (next === left.endDate) return;
    event.preventDefault();
    const minimum = addDays(left.startDate, 1);
    const maximum = addDays(right.endDate, -1);
    const boundary = next < minimum ? minimum : next > maximum ? maximum : next;
    void onMoveBoundary(left.id, right.id, boundary);
  }

  function startStayEdgeDrag(
    event: React.PointerEvent,
    stay: Stay,
    edge: Exclude<StayDragState['edge'], 'move'>,
  ) {
    event.preventDefault();
    suppressNextItemClick();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const originalDate = edge === 'checkIn' ? stay.checkInDate : stay.checkOutDate;
    const bandElement = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      '[data-stay-band-id]',
    );
    if (!bandElement) return;
    const nextDrag = {
      stay,
      edge,
      originalDate,
      date: originalDate,
      offsetDays: 0,
      pointerStartX: event.clientX,
      dragElement: event.currentTarget as HTMLElement,
      bandElement,
      bandWidth: bandElement.getBoundingClientRect().width,
      snapOffsetX: null,
    };
    stayDragRef.current = nextDrag;
    setStayDrag(nextDrag);
  }

  function startStayMove(event: React.PointerEvent, stay: Stay) {
    if (event.button !== 0) return;
    event.preventDefault();
    const weekElement = (event.target as HTMLElement).closest<HTMLElement>('[data-timeline-week]');
    if (!weekElement) return;
    const dateCells = Array.from(
      weekElement.querySelectorAll<HTMLElement>('[data-timeline-column-date]'),
    );
    const dateCell = dateCells.reduce<HTMLElement | undefined>((closest, candidate) => {
      if (!closest) return candidate;
      const closestRect = closest.getBoundingClientRect();
      const candidateRect = candidate.getBoundingClientRect();
      const closestDistance = Math.abs(event.clientX - (closestRect.left + closestRect.width / 2));
      const candidateDistance = Math.abs(
        event.clientX - (candidateRect.left + candidateRect.width / 2),
      );
      return candidateDistance < closestDistance ? candidate : closest;
    }, undefined);
    if (!dateCell?.dataset.timelineColumnDate) return;
    const rect = dateCell.getBoundingClientRect();
    const date = dateCell.dataset.timelineColumnDate;
    const pointerDate = event.clientX < rect.left + rect.width / 2 ? date : addDays(date, 1);
    const nextDrag = {
      stay,
      edge: 'move',
      originalDate: stay.checkInDate,
      date: stay.checkInDate,
      offsetDays: dateDifference(stay.checkInDate, pointerDate),
      pointerStartX: event.clientX,
      dragElement: event.currentTarget as HTMLElement,
      bandElement: event.currentTarget as HTMLElement,
      bandWidth: (event.currentTarget as HTMLElement).getBoundingClientRect().width,
      snapOffsetX: null,
    } satisfies StayDragState;
    stayDragRef.current = nextDrag;
    setStayDrag(nextDrag);
  }

  function moveStayEdgeWithKeyboard(
    event: React.KeyboardEvent,
    stay: Stay,
    edge: StayDragState['edge'],
  ) {
    const currentDate = edge === 'checkIn' ? stay.checkInDate : stay.checkOutDate;
    let nextDate = currentDate;
    if (event.key === 'ArrowLeft') nextDate = addDays(currentDate, -1);
    if (event.key === 'ArrowRight') nextDate = addDays(currentDate, 1);
    if (event.key === 'Home')
      nextDate = edge === 'checkIn' ? firstDate : addDays(stay.checkInDate, 1);
    if (event.key === 'End')
      nextDate = edge === 'checkIn' ? addDays(stay.checkOutDate, -1) : lastDate;
    if (nextDate === currentDate) return;
    event.preventDefault();
    const ordered = [...stays].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
    const index = ordered.findIndex(item => item.id === stay.id);
    const minimum =
      edge === 'checkIn'
        ? (ordered[index - 1]?.checkOutDate ?? firstDate)
        : addDays(stay.checkInDate, 1);
    const maximum =
      edge === 'checkIn'
        ? addDays(stay.checkOutDate, -1)
        : (ordered[index + 1]?.checkInDate ?? lastDate);
    const date = nextDate < minimum ? minimum : nextDate > maximum ? maximum : nextDate;
    void onMoveStayDates(
      stay.id,
      edge === 'checkIn' ? date : stay.checkInDate,
      edge === 'checkOut' ? date : stay.checkOutDate,
    );
  }

  function saveLocation() {
    const editor = locationEditor;
    if (!editor || !editor.draft.locationName.trim()) return;
    setLocationEditor(null);
    if (editor.mode === 'add' && editor.rangeStart && editor.rangeEnd) {
      void onCreateLocationDivision(editor.rangeStart, editor.rangeEnd, editor.draft).catch(() => {
        // The save handler restores the optimistic state and displays the error.
      });
    } else if (editor.mode === 'add' && editor.segmentId) {
      void onAddLocation(editor.segmentId, editor.splitDate, editor.draft).catch(() => {
        // The save handler restores the optimistic state and displays the error.
      });
    } else if (editor.mode === 'edit' && editor.segmentId) {
      void onUpdateLocation(editor.segmentId, editor.draft).catch(() => {
        // The save handler restores the optimistic state and displays the error.
      });
    }
  }

  function saveStay() {
    const editor = stayEditor;
    if (!editor || !editor.draft.name.trim()) return;
    setStayEditor(null);
    const save = editor.stayId
      ? onUpdateStay(editor.stayId, editor.draft)
      : onCreateStay(editor.draft);
    void save.catch(() => {
      // The save handler already restored the optimistic state and displayed the error.
    });
  }

  function deleteStay(stayId: string) {
    // Close before the request so the optimistic removal is reflected immediately.
    setStayEditor(null);
    void onDeleteStay(stayId).catch(() => {
      // The delete handler restores the optimistic state and displays the error.
    });
  }

  function openLocationEditor(segment: LocationSegment, mode: 'add' | 'edit', splitDate?: string) {
    setLocationEditor({
      mode,
      segmentId: segment.id,
      splitDate: splitDate ?? addDays(segment.startDate, 1),
      draft: defaultLocationDraft(mode === 'edit' ? segment : undefined),
    });
  }

  function openLocationRangeEditor(startDate: string, endDate: string) {
    setSelectedRange(null);
    setLocationEditor({
      mode: 'add',
      splitDate: endDate,
      rangeStart: startDate,
      rangeEnd: endDate,
      draft: defaultLocationDraft(),
    });
  }

  function openStayRangeEditor(startDate: string, endDate: string) {
    setSelectedRange(null);
    setStayEditor({
      draft: defaultStayDraft(undefined, startDate, addDays(endDate, 1), defaultCurrency),
    });
  }

  function openStayEditor(stay?: Stay) {
    setStayEditor({
      stayId: stay?.id,
      draft: defaultStayDraft(stay, firstNight, lastDate, defaultCurrency),
    });
  }

  const selectionSummary =
    locationEditor?.rangeStart && locationEditor.rangeEnd
      ? `${locationEditor.rangeStart} → ${locationEditor.rangeEnd} · ${dateDifference(locationEditor.rangeStart, locationEditor.rangeEnd)} nights`
      : undefined;
  const dateViewsClassName = [
    styles.dateViews,
    stripScrollState.canScrollPrevious ? styles.dateViewsHasPrevious : '',
    stripScrollState.canScrollNext ? styles.dateViewsHasNext : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={`${styles.dateBar} ${expanded ? styles.dateBarExpanded : ''}`} data-enter>
      <button
        type="button"
        className={styles.dateNavButton}
        aria-label="Previous dates"
        disabled={!expanded && !stripScrollState.canScrollPrevious}
        onClick={() => moveWindow(-1)}
      >
        <ChevronLeft size={17} />
      </button>
      {days.length ? (
        <>
          <div className={dateViewsClassName}>
            <DateStrip
              ref={dateStripRef}
              days={days}
              selectedDate={selectedLocationId ? null : optimisticSelectedDate}
              locationSegments={locationSegments}
              selectedLocationId={selectedLocationId}
              schedule={schedule}
              places={places}
              onSelectDay={selectDay}
              onSelectLocation={onSelectLocation}
              onAddPlaceToLocation={onAddPlaceToLocation}
              onMoveActivity={onMoveActivity}
              onAddPlaceToDay={onAddPlaceToDay}
              onScrollStateChange={setStripScrollState}
            />
          </div>
          <div
            id="trip-timeline-overlay"
            className={`${styles.expandedTimelineOverlay} ${expanded ? styles.expandedTimelineOverlayActive : ''}`}
            aria-hidden={!expanded}
          >
            <ExpandedTimeline
              days={days}
              selectedDate={optimisticSelectedDate}
              schedule={schedule}
              locationSegments={effectiveSegments}
              stays={effectiveStays}
              places={places}
              destinationLabel={destinationLabel}
              onSavePlace={onSavePlace}
              visibleRange={visibleRange}
              rangeDragStart={dateRangeDrag?.start ?? null}
              locationEditor={locationEditor}
              stayEditor={stayEditor}
              timelineRef={timelineRef}
              onStartDateRange={startDateRange}
              onStartLocationRange={(event, date) => startDateRange(event, date, 'location')}
              onStartStayRange={(event, date) => startDateRange(event, date, 'stay')}
              onUpdateDateRange={updateDateRange}
              onClickNoStay={date => {
                if (rangeMoved) {
                  setRangeMoved(false);
                  return;
                }
                selectDay(date);
                openStayRangeEditor(date, date);
              }}
              onClickDate={date => {
                if (rangeMoved) {
                  setRangeMoved(false);
                  return;
                }
                selectDay(date);
              }}
              onOpenLocation={openLocationEditor}
              onSelectLocation={onSelectLocation}
              onAddPlaceToLocation={onAddPlaceToLocation}
              shouldOpenTimelineItem={shouldOpenTimelineItem}
              onDeleteLocation={segmentId => void onDeleteLocation(segmentId)}
              onStartBoundaryDrag={startBoundaryDrag}
              onMoveBoundaryWithKeyboard={moveBoundaryWithKeyboard}
              onStartLocationEdgeDrag={startLocationEdgeDrag}
              onMoveLocationEdgeWithKeyboard={moveLocationEdgeWithKeyboard}
              onStartLocationMove={startLocationMove}
              onStartSharedBoundaryDrag={startSharedBoundaryDrag}
              onStartStayEdgeDrag={startStayEdgeDrag}
              onMoveStayEdgeWithKeyboard={moveStayEdgeWithKeyboard}
              onStartStayMove={startStayMove}
              onEditStay={openStayEditor}
              onDeleteStay={deleteStay}
              onOpenLocationRange={openLocationRangeEditor}
              onChangeLocation={next =>
                setLocationEditor(current => (current ? { ...current, ...next } : current))
              }
              onChangeLocationDraft={next =>
                setLocationEditor(current =>
                  current ? { ...current, draft: { ...current.draft, ...next } } : current,
                )
              }
              onCloseLocation={() => setLocationEditor(null)}
              onSaveLocation={() => void saveLocation()}
              onChangeStayDraft={next =>
                setStayEditor(current =>
                  current ? { ...current, draft: { ...current.draft, ...next } } : current,
                )
              }
              onCloseStay={() => setStayEditor(null)}
              onSaveStay={() => void saveStay()}
              selectionSummary={selectionSummary}
            />
          </div>
          <button
            type="button"
            className={styles.timelineBackdrop}
            aria-label="Close timeline"
            tabIndex={-1}
            onClick={() => setExpanded(false)}
          />
        </>
      ) : (
        <div className={styles.noTripDates}>Create a trip to start adding days</div>
      )}
      <button
        type="button"
        ref={expandButtonRef}
        className={`${styles.expandButton} ${expanded ? styles.expandButtonActive : ''}`}
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls="trip-timeline-overlay"
        disabled={!days.length}
      >
        <CalendarDays size={15} /> <span>{expanded ? 'Close' : 'Timeline'}</span>
        <ChevronDown size={14} />
      </button>
      <button
        type="button"
        className={styles.dateNavButton}
        aria-label="Next dates"
        disabled={!expanded && !stripScrollState.canScrollNext}
        onClick={() => moveWindow(1)}
      >
        <ChevronRight size={17} />
      </button>
    </section>
  );
}
