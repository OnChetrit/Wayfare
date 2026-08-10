import { memo, useMemo, type RefObject } from 'react';
import styles from './ExpandedTimeline.module.scss';
import { LocationEditor } from './LocationEditor';
import { StayEditor } from './StayEditor';
import { TimelineWeek } from './TimelineWeek';
import { addDays, getUtcDateValue, weekdayLabels } from './date-bar-utils';
import type {
  LocationEditorState,
  LocationDraft,
  StayDraft,
  StayEditorState,
} from './date-bar-types';
import type { SavePlace } from './date-bar-types';
import type { LocationSegment, SavedPlace, ScheduleItem, Stay, TripDay } from './types';
import { parseTimelineDragPayload } from './timeline-dnd';

function formatSelectionDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

type ExpandedTimelineProps = {
  days: TripDay[];
  selectedDate: string;
  schedule: ScheduleItem[];
  locationSegments: LocationSegment[];
  stays: Stay[];
  places: SavedPlace[];
  destinationLabel?: string | null;
  onSavePlace: SavePlace;
  visibleRange: { start: string; end: string } | null;
  rangeDragStart: string | null;
  locationEditor: LocationEditorState | null;
  stayEditor: StayEditorState | null;
  timelineRef: RefObject<HTMLDivElement | null>;
  onStartDateRange: (event: React.PointerEvent, date: string) => void;
  onStartLocationRange: (event: React.PointerEvent, date: string) => void;
  onStartStayRange: (event: React.PointerEvent, date: string) => void;
  onUpdateDateRange: (date: string) => void;
  onClickNoStay: (date: string) => void;
  onClickDate: (date: string) => void;
  onOpenLocation: (segment: LocationSegment, mode: 'add' | 'edit', splitDate?: string) => void;
  onSelectLocation: (segment: LocationSegment) => void;
  onAddPlaceToLocation: (place: SavedPlace, location: LocationSegment) => void;
  shouldOpenTimelineItem: () => boolean;
  onDeleteLocation: (segmentId: string) => void;
  onStartBoundaryDrag: (
    event: React.PointerEvent,
    left: LocationSegment,
    right: LocationSegment,
  ) => void;
  onMoveBoundaryWithKeyboard: (
    event: React.KeyboardEvent,
    left: LocationSegment,
    right: LocationSegment,
  ) => void;
  onStartLocationEdgeDrag: (
    event: React.PointerEvent,
    segment: LocationSegment,
    edge: 'start' | 'end',
  ) => void;
  onMoveLocationEdgeWithKeyboard: (
    event: React.KeyboardEvent,
    segment: LocationSegment,
    edge: 'start' | 'end',
  ) => void;
  onStartLocationMove: (event: React.PointerEvent, segment: LocationSegment) => void;
  onStartSharedBoundaryDrag: (
    event: React.PointerEvent,
    left: LocationSegment,
    right: LocationSegment,
    stay: Stay,
  ) => void;
  onStartStayEdgeDrag: (
    event: React.PointerEvent,
    stay: Stay,
    edge: 'checkIn' | 'checkOut',
  ) => void;
  onMoveStayEdgeWithKeyboard: (
    event: React.KeyboardEvent,
    stay: Stay,
    edge: 'checkIn' | 'checkOut',
  ) => void;
  onStartStayMove: (event: React.PointerEvent, stay: Stay) => void;
  onEditStay: (stay: Stay) => void;
  onDeleteStay: (stayId: string) => void;
  onOpenLocationRange: (startDate: string, endDate: string) => void;
  onChangeLocation: (next: Partial<LocationEditorState>) => void;
  onChangeLocationDraft: (next: Partial<LocationDraft>) => void;
  onCloseLocation: () => void;
  onSaveLocation: () => void;
  onChangeStayDraft: (next: Partial<StayDraft>) => void;
  onCloseStay: () => void;
  onSaveStay: () => void;
  selectionSummary?: string;
};

function ExpandedTimelineComponent({
  days,
  selectedDate,
  schedule,
  locationSegments,
  stays,
  places,
  destinationLabel,
  onSavePlace,
  visibleRange,
  rangeDragStart,
  locationEditor,
  stayEditor,
  timelineRef,
  onStartDateRange,
  onStartLocationRange,
  onStartStayRange,
  onUpdateDateRange,
  onClickNoStay,
  onClickDate,
  onOpenLocation,
  onSelectLocation,
  onAddPlaceToLocation,
  shouldOpenTimelineItem,
  onDeleteLocation,
  onStartBoundaryDrag,
  onMoveBoundaryWithKeyboard,
  onStartLocationEdgeDrag,
  onMoveLocationEdgeWithKeyboard,
  onStartLocationMove,
  onStartSharedBoundaryDrag,
  onStartStayEdgeDrag,
  onMoveStayEdgeWithKeyboard,
  onStartStayMove,
  onEditStay,
  onDeleteStay,
  onOpenLocationRange,
  onChangeLocation,
  onChangeLocationDraft,
  onCloseLocation,
  onSaveLocation,
  onChangeStayDraft,
  onCloseStay,
  onSaveStay,
  selectionSummary,
}: ExpandedTimelineProps) {
  const firstDate = days[0]?.date ?? '';
  const lastDate = days[days.length - 1]?.date ?? '';
  const weeks = useMemo(() => {
    if (!firstDate || !lastDate) return [];
    const firstWeekStart = addDays(firstDate, -new Date(getUtcDateValue(firstDate)).getUTCDay());
    const lastWeekStart = addDays(lastDate, -new Date(getUtcDateValue(lastDate)).getUTCDay());
    const result: Array<{ start: string; end: string }> = [];
    for (let start = firstWeekStart; start <= lastWeekStart; start = addDays(start, 7)) {
      result.push({ start, end: addDays(start, 7) });
    }
    return result;
  }, [firstDate, lastDate]);
  const scheduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    schedule.forEach(item => counts.set(item.date, (counts.get(item.date) ?? 0) + 1));
    return counts;
  }, [schedule]);
  const selectionLabel = visibleRange
    ? visibleRange.start === visibleRange.end
      ? `${formatSelectionDate(visibleRange.start)} selected`
      : `${formatSelectionDate(visibleRange.start)} – ${formatSelectionDate(visibleRange.end)} selected`
    : '';

  return (
    <div
      className={`${styles.dateScroller} ${locationEditor || stayEditor ? styles.dateScrollerEditing : ''}`}
      ref={timelineRef}
      tabIndex={-1}
      role="region"
      aria-label="Trip timeline"
    >
      <div className={styles.timelineStickyHeader}>
        <div className={styles.timelineWeekLabels} aria-hidden="true">
          {weekdayLabels.map(label => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
      <div className={styles.timelineGrid}>
        {weeks.map(week => (
          <TimelineWeek
            key={week.start}
            week={week}
            days={days}
            selectedDate={selectedDate}
            scheduleCounts={scheduleCounts}
            locationSegments={locationSegments}
            stays={stays}
            visibleRange={visibleRange}
            rangeDragStart={rangeDragStart}
            onStartBoundaryDrag={onStartBoundaryDrag}
            onMoveBoundaryWithKeyboard={onMoveBoundaryWithKeyboard}
            onStartLocationEdgeDrag={onStartLocationEdgeDrag}
            onMoveLocationEdgeWithKeyboard={onMoveLocationEdgeWithKeyboard}
            onStartLocationMove={onStartLocationMove}
            onStartSharedBoundaryDrag={onStartSharedBoundaryDrag}
            onStartStayEdgeDrag={onStartStayEdgeDrag}
            onMoveStayEdgeWithKeyboard={onMoveStayEdgeWithKeyboard}
            onStartStayMove={onStartStayMove}
            onStartDateRange={onStartDateRange}
            onStartLocationRange={onStartLocationRange}
            onStartStayRange={onStartStayRange}
            onUpdateDateRange={onUpdateDateRange}
            onOpenLocationRange={onOpenLocationRange}
            onClickNoStay={onClickNoStay}
            onClickDate={onClickDate}
            onSelectLocation={onSelectLocation}
            onEditLocation={segment => onOpenLocation(segment, 'edit')}
            onDropPlaceOnLocation={(event, location) => {
              const payload = parseTimelineDragPayload(event);
              if (payload?.type !== 'place') return;
              const place = places.find(item => item.id === payload.placeId);
              if (place) onAddPlaceToLocation(place, location);
            }}
            onSelectStay={onEditStay}
            shouldOpenTimelineItem={shouldOpenTimelineItem}
          />
        ))}
      </div>
      {locationEditor && (
        <LocationEditor
          editor={locationEditor}
          selectionSummary={selectionSummary}
          onChange={onChangeLocation}
          onChangeDraft={onChangeLocationDraft}
          onClose={onCloseLocation}
          onSave={onSaveLocation}
          onDelete={
            locationEditor.mode === 'edit' && locationEditor.segmentId
              ? () => onDeleteLocation(locationEditor.segmentId!)
              : undefined
          }
        />
      )}
      {stayEditor && (
        <StayEditor
          editor={stayEditor}
          places={places}
          destinationLabel={destinationLabel}
          onSavePlace={onSavePlace}
          onChangeDraft={onChangeStayDraft}
          onClose={onCloseStay}
          onSave={onSaveStay}
          onDelete={stayEditor.stayId ? () => onDeleteStay(stayEditor.stayId!) : undefined}
        />
      )}
    </div>
  );
}

function areTimelinePropsEqual(
  previous: React.ComponentProps<typeof ExpandedTimelineComponent>,
  next: React.ComponentProps<typeof ExpandedTimelineComponent>,
) {
  return (
    previous.days === next.days &&
    previous.selectedDate === next.selectedDate &&
    previous.schedule === next.schedule &&
    previous.locationSegments === next.locationSegments &&
    previous.stays === next.stays &&
    previous.places === next.places &&
    previous.visibleRange === next.visibleRange &&
    previous.rangeDragStart === next.rangeDragStart &&
    previous.locationEditor === next.locationEditor &&
    previous.stayEditor === next.stayEditor &&
    previous.timelineRef === next.timelineRef &&
    previous.onSelectLocation === next.onSelectLocation &&
    previous.onAddPlaceToLocation === next.onAddPlaceToLocation &&
    previous.selectionSummary === next.selectionSummary
  );
}

export const ExpandedTimeline = memo(ExpandedTimelineComponent, areTimelinePropsEqual);
