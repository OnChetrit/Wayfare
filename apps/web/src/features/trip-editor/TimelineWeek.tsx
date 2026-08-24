import { memo } from 'react';
import styles from './TimelineWeek.module.scss';
import {
  addDays,
  dateDifference,
  segmentLabel,
  segmentSlice,
  staySlice,
  timelineBandSlice,
} from './date-bar-utils';
import type { LocationSegment, Stay, TripDay } from './types';

type TimelineWeekProps = {
  week: { start: string; end: string };
  days: TripDay[];
  selectedDate: string;
  scheduleCounts: ReadonlyMap<string, number>;
  locationSegments: LocationSegment[];
  stays: Stay[];
  visibleRange: { start: string; end: string } | null;
  rangeDragStart: string | null;
  onSelectLocation: (segment: LocationSegment) => void;
  onEditLocation: (segment: LocationSegment) => void;
  onDropPlaceOnLocation: (event: React.DragEvent<HTMLElement>, location: LocationSegment) => void;
  onSelectStay: (stay: Stay) => void;
  shouldOpenTimelineItem: () => boolean;
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
  onStartDateRange: (event: React.PointerEvent, date: string) => void;
  onStartLocationRange: (event: React.PointerEvent, date: string) => void;
  onStartStayRange: (event: React.PointerEvent, date: string) => void;
  onUpdateDateRange: (date: string) => void;
  onOpenLocationRange: (startDate: string, endDate: string) => void;
  onClickNoStay: (date: string) => void;
  onClickDate: (date: string) => void;
};

function TimelineWeekComponent({
  week,
  days,
  selectedDate,
  scheduleCounts,
  locationSegments,
  stays,
  visibleRange,
  rangeDragStart,
  onSelectLocation,
  onEditLocation,
  onDropPlaceOnLocation,
  onSelectStay,
  shouldOpenTimelineItem,
  onStartBoundaryDrag,
  onMoveBoundaryWithKeyboard,
  onStartLocationEdgeDrag,
  onMoveLocationEdgeWithKeyboard,
  onStartLocationMove,
  onStartSharedBoundaryDrag,
  onStartStayEdgeDrag,
  onMoveStayEdgeWithKeyboard,
  onStartStayMove,
  onStartDateRange,
  onStartLocationRange,
  onStartStayRange,
  onUpdateDateRange,
  onOpenLocationRange,
  onClickNoStay,
  onClickDate,
}: TimelineWeekProps) {
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(week.start, index));
  const dayMap = new Map(days.map(day => [day.date, day]));
  const visibleNights = weekDays.filter(
    date => date >= (days[0]?.date ?? '') && date < (days.at(-1)?.date ?? ''),
  );
  const dateIsInRange = (date: string) => {
    if (!visibleRange) return false;
    const start = visibleRange.start < visibleRange.end ? visibleRange.start : visibleRange.end;
    const end = visibleRange.start < visibleRange.end ? visibleRange.end : visibleRange.start;
    return date >= start && date <= end;
  };

  return (
    <section className={styles.timelineWeek} data-timeline-week={week.start}>
      <LocationBands
        week={week}
        segments={locationSegments}
        onSelectLocation={onSelectLocation}
        onEditLocation={onEditLocation}
        onDropPlaceOnLocation={onDropPlaceOnLocation}
        shouldOpenTimelineItem={shouldOpenTimelineItem}
        onStartBoundaryDrag={onStartBoundaryDrag}
        onMoveBoundaryWithKeyboard={onMoveBoundaryWithKeyboard}
        onStartLocationEdgeDrag={onStartLocationEdgeDrag}
        onMoveLocationEdgeWithKeyboard={onMoveLocationEdgeWithKeyboard}
        onStartLocationMove={onStartLocationMove}
        onStartSharedBoundaryDrag={onStartSharedBoundaryDrag}
        stays={stays}
        days={days}
        onStartLocationRange={onStartLocationRange}
        onUpdateDateRange={onUpdateDateRange}
        onOpenLocationRange={onOpenLocationRange}
      />
      <div className={styles.timelineBands}>
        {visibleNights.map(date => {
          if (stays.some(stay => stay.checkInDate <= date && date < stay.checkOutDate)) {
            return null;
          }
          const slice = timelineBandSlice(date, addDays(date, 1), week.start, week.end);
          if (!slice) return null;
          return (
            <button
              type="button"
              key={date}
              className={styles.noStayBand}
              style={{ gridColumn: `${slice.startColumn} / ${slice.endColumn}` }}
              onPointerDown={event => onStartStayRange(event, date)}
              onPointerEnter={() => onUpdateDateRange(date)}
              onClick={() => onClickNoStay(date)}
              aria-label={`Add stay for ${date}`}
            >
              No stay
            </button>
          );
        })}
        {stays.map(stay => {
          const slice = staySlice(stay, week.start, week.end);
          if (!slice) return null;
          return (
            <div
              key={stay.id}
              data-stay-band-id={stay.id}
              className={styles.stayBand}
              style={{ gridColumn: `${slice.startColumn} / ${slice.endColumn}` }}
              role="button"
              tabIndex={0}
              onPointerDown={event => onStartStayMove(event, stay)}
              onClick={() => shouldOpenTimelineItem() && onSelectStay(stay)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectStay(stay);
                }
              }}
            >
              <button
                type="button"
                className={`${styles.timelineDragHandle} ${styles.stayDragHandle} ${styles.stayDragHandleStart}`}
                onPointerDown={event => onStartStayEdgeDrag(event, stay, 'checkIn')}
                onKeyDown={event => onMoveStayEdgeWithKeyboard(event, stay, 'checkIn')}
                aria-label={`Move check-in for ${stay.name}`}
                aria-valuemin={0}
                aria-valuemax={
                  dateDifference(days[0]?.date ?? stay.checkInDate, stay.checkOutDate) - 1
                }
                aria-valuenow={dateDifference(days[0]?.date ?? stay.checkInDate, stay.checkInDate)}
                aria-valuetext={stay.checkInDate}
                role="slider"
              >
                ⋮
              </button>
              <span>
                {stay.name} <small>{dateDifference(stay.checkInDate, stay.checkOutDate)}n</small>
              </span>
              <button
                type="button"
                className={`${styles.timelineDragHandle} ${styles.stayDragHandle} ${styles.stayDragHandleEnd}`}
                onPointerDown={event => onStartStayEdgeDrag(event, stay, 'checkOut')}
                onKeyDown={event => onMoveStayEdgeWithKeyboard(event, stay, 'checkOut')}
                aria-label={`Move check-out for ${stay.name}`}
                aria-valuemin={1}
                aria-valuemax={dateDifference(
                  stay.checkInDate,
                  days.at(-1)?.date ?? stay.checkOutDate,
                )}
                aria-valuenow={dateDifference(stay.checkInDate, stay.checkOutDate)}
                aria-valuetext={stay.checkOutDate}
                role="slider"
              >
                ⋮
              </button>
            </div>
          );
        })}
      </div>
      <div className={styles.timelineDateCells}>
        {weekDays.map(date => {
          const day = dayMap.get(date);
          const isNight = date >= (days[0]?.date ?? '') && date < (days.at(-1)?.date ?? '');
          const count = scheduleCounts.get(date) ?? 0;
          return day ? (
            <button
              key={date}
              type="button"
              data-timeline-date={isNight ? date : undefined}
              data-timeline-column-date={date}
              className={`${styles.timelineDateCell} ${selectedDate === date ? styles.timelineDateCellActive : ''} ${dateIsInRange(date) ? styles.timelineDateCellRange : ''} ${rangeDragStart === date ? styles.timelineDateCellRangeAnchor : ''} ${isNight ? styles.timelineNightCell : ''}`}
              onPointerDown={event => isNight && onStartDateRange(event, date)}
              onPointerEnter={() => isNight && onUpdateDateRange(date)}
              onClick={() => onClickDate(date)}
            >
              <strong>{date.slice(-2)}</strong>
              <small>
                {count ? `${count} plan${count === 1 ? '' : 's'}` : isNight ? 'night' : 'checkout'}
              </small>
            </button>
          ) : (
            <span key={date} className={styles.timelineDateCellEmpty} />
          );
        })}
      </div>
    </section>
  );
}

function dateIsInWeek(date: string, week: { start: string; end: string }) {
  return date >= week.start && date < week.end;
}

function rangeTouchesWeek(
  range: { start: string; end: string } | null,
  week: { start: string; end: string },
) {
  if (!range) return false;
  const start = range.start < range.end ? range.start : range.end;
  const end = range.start < range.end ? range.end : range.start;
  return end >= week.start && start < week.end;
}

function areTimelineWeekPropsEqual(previous: TimelineWeekProps, next: TimelineWeekProps) {
  const selectedDateChanged = previous.selectedDate !== next.selectedDate;
  const rangeChanged = previous.visibleRange !== next.visibleRange;

  return (
    previous.week.start === next.week.start &&
    previous.week.end === next.week.end &&
    previous.days === next.days &&
    previous.scheduleCounts === next.scheduleCounts &&
    previous.locationSegments === next.locationSegments &&
    previous.stays === next.stays &&
    previous.rangeDragStart === next.rangeDragStart &&
    (!selectedDateChanged ||
      (!dateIsInWeek(previous.selectedDate, next.week) &&
        !dateIsInWeek(next.selectedDate, next.week))) &&
    (!rangeChanged ||
      (!rangeTouchesWeek(previous.visibleRange, next.week) &&
        !rangeTouchesWeek(next.visibleRange, next.week)))
  );
}

export const TimelineWeek = memo(TimelineWeekComponent, areTimelineWeekPropsEqual);

type LocationBandsProps = {
  week: { start: string; end: string };
  segments: LocationSegment[];
  onSelectLocation: (segment: LocationSegment) => void;
  onEditLocation: (segment: LocationSegment) => void;
  onDropPlaceOnLocation: (event: React.DragEvent<HTMLElement>, location: LocationSegment) => void;
  shouldOpenTimelineItem: TimelineWeekProps['shouldOpenTimelineItem'];
  onStartBoundaryDrag: TimelineWeekProps['onStartBoundaryDrag'];
  onMoveBoundaryWithKeyboard: TimelineWeekProps['onMoveBoundaryWithKeyboard'];
  onStartLocationEdgeDrag: TimelineWeekProps['onStartLocationEdgeDrag'];
  onMoveLocationEdgeWithKeyboard: TimelineWeekProps['onMoveLocationEdgeWithKeyboard'];
  onStartLocationMove: TimelineWeekProps['onStartLocationMove'];
  onStartSharedBoundaryDrag: TimelineWeekProps['onStartSharedBoundaryDrag'];
  stays: Stay[];
  days: TripDay[];
  onStartLocationRange: TimelineWeekProps['onStartLocationRange'];
  onUpdateDateRange: TimelineWeekProps['onUpdateDateRange'];
  onOpenLocationRange: TimelineWeekProps['onOpenLocationRange'];
};

function LocationBands({
  week,
  segments,
  onSelectLocation,
  onEditLocation,
  onDropPlaceOnLocation,
  shouldOpenTimelineItem,
  onStartBoundaryDrag,
  onMoveBoundaryWithKeyboard,
  onStartLocationEdgeDrag,
  onMoveLocationEdgeWithKeyboard,
  onStartLocationMove,
  onStartSharedBoundaryDrag,
  stays,
  days,
  onStartLocationRange,
  onUpdateDateRange,
  onOpenLocationRange,
}: LocationBandsProps) {
  const visibleNights = Array.from({ length: 7 }, (_, index) => addDays(week.start, index)).filter(
    date => date >= (days[0]?.date ?? '') && date < (days.at(-1)?.date ?? ''),
  );
  return (
    <div className={styles.timelineBands}>
      {visibleNights.map(date => {
        if (segments.some(segment => segment.startDate <= date && date < segment.endDate))
          return null;
        const slice = timelineBandSlice(date, addDays(date, 1), week.start, week.end);
        if (!slice) return null;
        return (
          <button
            type="button"
            key={date}
            className={`${styles.noStayBand} ${styles.emptyLocationBand}`}
            style={{ gridColumn: `${slice.startColumn} / ${slice.endColumn}` }}
            onPointerDown={event => onStartLocationRange(event, date)}
            onPointerEnter={() => onUpdateDateRange(date)}
            onClick={() => onOpenLocationRange(date, addDays(date, 1))}
            aria-label={`Add location for ${date}`}
          >
            No location
          </button>
        );
      })}
      {segments.map((segment, index) => {
        const slice = segmentSlice(segment, week.start, week.end);
        if (!slice) return null;
        const right = segments[index + 1];
        const showBoundaryHandle = Boolean(
          right &&
          // A boundary at the start of this week is rendered in this week.
          // Do not render the clipped copy at the previous week's right
          // edge (after Saturday).
          segment.endDate < week.end &&
          slice.end === segment.endDate,
        );
        const sharedStay = showBoundaryHandle
          ? stays.find(
              stay =>
                stay.checkOutDate === segment.endDate &&
                !stays.some(
                  candidate =>
                    candidate.id !== stay.id && candidate.checkInDate === segment.endDate,
                ),
            )
          : undefined;
        return (
          <div
            key={segment.id}
            data-location-band-id={segment.id}
            className={styles.locationBand}
            style={{ gridColumn: `${slice.startColumn} / ${slice.endColumn}` }}
            role="button"
            tabIndex={0}
            onPointerDown={event => onStartLocationMove(event, segment)}
            onClick={() => shouldOpenTimelineItem() && onSelectLocation(segment)}
            onDoubleClick={() => onEditLocation(segment)}
            onDragOver={event => event.preventDefault()}
            onDrop={event => onDropPlaceOnLocation(event, segment)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectLocation(segment);
              }
            }}
          >
            <button
              type="button"
              className={`${styles.timelineDragHandle} ${styles.locationDragHandle} ${styles.locationDragHandleStart}`}
              onPointerDown={event => onStartLocationEdgeDrag(event, segment, 'start')}
              onKeyDown={event => onMoveLocationEdgeWithKeyboard(event, segment, 'start')}
              aria-label={`Move start of ${segment.locationName}`}
              role="slider"
              aria-valuenow={dateDifference(days[0]?.date ?? segment.startDate, segment.startDate)}
              aria-valuetext={segment.startDate}
            >
              ⋮
            </button>
            <span className={styles.locationBandText} title={segmentLabel(segment)}>
              {segmentLabel(segment)}{' '}
              <small>{dateDifference(segment.startDate, segment.endDate)}n</small>
            </span>
            {right && showBoundaryHandle && (
              <button
                type="button"
                className={`${styles.timelineDragHandle} ${styles.boundaryHandle} ${sharedStay ? styles.sharedBoundaryHandle : ''}`}
                onPointerDown={event =>
                  sharedStay
                    ? onStartSharedBoundaryDrag(event, segment, right, sharedStay)
                    : onStartBoundaryDrag(event, segment, right)
                }
                onKeyDown={event => onMoveBoundaryWithKeyboard(event, segment, right)}
                aria-label={`Move boundary between ${segment.locationName} and ${right.locationName}`}
                aria-valuemin={1}
                aria-valuemax={dateDifference(segment.startDate, right.endDate) - 1}
                aria-valuenow={dateDifference(segment.startDate, segment.endDate)}
                aria-valuetext={segment.endDate}
                role="slider"
              >
                ⋮
              </button>
            )}
            <button
              type="button"
              className={`${styles.timelineDragHandle} ${styles.locationDragHandle} ${styles.locationDragHandleEnd}`}
              onPointerDown={event => onStartLocationEdgeDrag(event, segment, 'end')}
              onKeyDown={event => onMoveLocationEdgeWithKeyboard(event, segment, 'end')}
              aria-label={`Move end of ${segment.locationName}`}
              role="slider"
              aria-valuenow={dateDifference(segment.startDate, segment.endDate)}
              aria-valuetext={segment.endDate}
            >
              ⋮
            </button>
          </div>
        );
      })}
    </div>
  );
}
