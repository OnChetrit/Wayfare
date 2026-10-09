import { Fragment, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { orderScheduleItemsForDay } from '@wayfare/domain';
import {
  AlarmClock,
  GripVertical,
  Lock,
  MessageSquareText,
  Plane,
  Plus,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import styles from './DayPlanPanel.module.scss';
import { ItemIndicators } from './TripItemTools';
import { categoryMeta } from './data';
import {
  parseTimelineDragPayload,
  setTimelineDragPayload,
  type TimelineDropPlacement,
} from './timeline-dnd';
import { flightTime } from '@/lib/trips/flights';
import type { EditorMode, SavedPlace, ScheduleItem, Stay, TripDay, TripFlight } from './types';

type DayPlanPanelProps = {
  mode: EditorMode;
  selectedDay: TripDay | null;
  isFirstDay: boolean;
  isLastDay: boolean;
  hasArrivalFlight: boolean;
  hasDepartureFlight: boolean;
  selectedSchedule: ScheduleItem[];
  selectedFlights: TripFlight[];
  stays: Stay[];
  destinationLabel?: string | null;
  places: SavedPlace[];
  selectedPlaceId: string | null;
  onClose: () => void;
  onReorder: (
    itemId: string,
    targetId: string,
    placement: TimelineDropPlacement,
  ) => void | Promise<void>;
  onEdit: (item: ScheduleItem) => void;
  onRemove: (itemId: string) => void;
  onToggleActivityLock: (item: ScheduleItem) => void | Promise<void>;
  onOpenActivityEditor: () => void;
  onOpenTravelDetails: () => void;
  onOpenDayNotes: () => void;
  onOpenReminders: () => void;
  canCreateReminders: boolean;
  canLockActivities: boolean;
  onCreateReminder: (item: ScheduleItem, title: string) => void;
};

function StayTimelineItem({
  stay,
  position,
  hasNext,
}: {
  stay: Stay;
  position: 'start' | 'sleep';
  hasNext?: boolean;
}) {
  return (
    <div className={styles.timelineEvent}>
      <div className={styles.timelineMarker}>{position === 'start' ? 'Start' : 'Sleep'}</div>
      <div className={`${styles.timelineItem} ${styles.timelineItemHotel}`}>
        <div className={styles.timelineTrack}>
          <div className={styles.timelineDot} style={{ backgroundColor: '#9b7bc4' }}>
            ⌂
          </div>
          {hasNext && <div className={styles.timelineLine} />}
        </div>
        <div className={styles.scheduleCard}>
          <div className={styles.scheduleCardTop}>
            <span
              className={styles.categoryPill}
              style={{ color: '#805da9', backgroundColor: '#9b7bc418' }}
            >
              ⌂ {position === 'start' ? 'Stay' : 'Sleep here'}
            </span>
          </div>
          <strong>{stay.name}</strong>
          <span>
            {stay.locationLabel ??
              stay.address ??
              (position === 'start' ? 'Starting location' : 'Overnight stay')}
          </span>
        </div>
      </div>
    </div>
  );
}

function TravelPlaceholder({
  kind,
  onAdd,
  hasNext,
}: {
  kind: 'arrival' | 'departure';
  onAdd: () => void;
  hasNext?: boolean;
}) {
  const arrival = kind === 'arrival';
  return (
    <div className={styles.timelineEvent}>
      <div className={styles.timelineMarker}>{arrival ? 'Arrive' : 'Leave'}</div>
      <div className={`${styles.timelineItem} ${styles.timelineItemTravel}`}>
        <div className={styles.timelineTrack}>
          <div className={styles.timelineDot} style={{ backgroundColor: '#6a9c88' }}>
            {arrival ? '↘' : '↗'}
          </div>
          {hasNext && <div className={styles.timelineLine} />}
        </div>
        <button type="button" className={styles.travelCard} onClick={onAdd}>
          <span
            className={styles.categoryPill}
            style={{ color: '#4e806c', backgroundColor: '#6a9c8818' }}
          >
            ↗ Travel
          </span>
          <strong>{arrival ? 'How are you getting here?' : 'How are you getting home?'}</strong>
          <span>
            {arrival
              ? 'Airport, train, or a journey from home'
              : 'Airport, train, or the trip back home'}
          </span>
          <span className={styles.travelAction}>＋ Add travel details</span>
        </button>
      </div>
    </div>
  );
}

function FlightTimelineItem({
  flight,
  event,
  hasNext,
}: {
  flight: TripFlight;
  event: 'arrival' | 'departure';
  hasNext?: boolean;
}) {
  const departure = flight.departureAirportIata ?? flight.departureAirportName ?? 'Departure';
  const arrival = flight.arrivalAirportIata ?? flight.arrivalAirportName ?? 'Arrival';
  const isArrival = event === 'arrival';
  const eventLabel = isArrival ? 'Flight arrival' : 'Flight departure';
  const flightDetails = [
    flight.flightNumber,
    flight.airlineName ?? flight.airlineIata,
    flight.status,
    isArrival
      ? flight.arrivalTerminal
        ? `T${flight.arrivalTerminal}`
        : undefined
      : flight.departureTerminal
        ? `T${flight.departureTerminal}`
        : undefined,
    isArrival
      ? flight.arrivalGate
        ? `Gate ${flight.arrivalGate}`
        : undefined
      : flight.departureGate
        ? `Gate ${flight.departureGate}`
        : undefined,
    isArrival && flight.arrivalBaggageBelt ? `Baggage ${flight.arrivalBaggageBelt}` : undefined,
  ].filter(Boolean);

  return (
    <div className={styles.timelineEvent}>
      <div className={styles.timelineMarker}>
        {flightTime(isArrival ? flight.scheduledArrivalLocal : flight.scheduledDepartureLocal)}
      </div>
      <div
        className={`${styles.timelineItem} ${styles.timelineItemFlight} ${isArrival ? styles.flightArrival : styles.flightDeparture}`}
      >
        <div className={styles.timelineTrack}>
          <div className={styles.timelineDot}>
            <Plane
              size={13}
              className={isArrival ? styles.flightPlaneArrival : styles.flightPlaneDeparture}
            />
          </div>
          {hasNext && <div className={styles.timelineLine} />}
        </div>
        <div className={styles.scheduleCard}>
          <div className={styles.scheduleCardTop}>
            <span
              className={styles.categoryPill}
              style={
                isArrival
                  ? {
                      color: 'var(--coral)',
                      backgroundColor: 'color-mix(in srgb, var(--coral) 14%, transparent)',
                    }
                  : {
                      color: 'var(--green-dark)',
                      backgroundColor: 'color-mix(in srgb, var(--green) 14%, transparent)',
                    }
              }
            >
              <Plane
                size={10}
                className={isArrival ? styles.flightPlaneArrival : styles.flightPlaneDeparture}
              />{' '}
              {eventLabel}
            </span>
          </div>
          <strong>{isArrival ? `${arrival} ← ${departure}` : `${departure} → ${arrival}`}</strong>
          {flightDetails.length > 0 && (
            <div className={styles.flightDetails}>
              {flightDetails.map((detail, index) => (
                <span key={`${detail}-${index}`} className={styles.flightDetailTag}>
                  {detail}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ScheduleDropTarget = {
  itemId: string;
  placement: TimelineDropPlacement;
};

function pointerPlacement(element: HTMLElement, clientY: number): TimelineDropPlacement {
  const bounds = element.getBoundingClientRect();
  return clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
}

export function DayPlanPanel({
  mode,
  selectedDay,
  isFirstDay,
  isLastDay,
  hasArrivalFlight,
  hasDepartureFlight,
  selectedSchedule,
  selectedFlights,
  stays,
  destinationLabel,
  places,
  selectedPlaceId,
  onClose,
  onReorder,
  onEdit,
  onRemove,
  onToggleActivityLock,
  onOpenActivityEditor,
  onOpenTravelDetails,
  onOpenDayNotes,
  onOpenReminders,
  canCreateReminders,
  canLockActivities,
  onCreateReminder,
}: DayPlanPanelProps) {
  const [lockPendingId, setLockPendingId] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ScheduleDropTarget | null>(null);
  const draggingItemIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<ScheduleDropTarget | null>(null);
  const activityWasDragged = useRef(false);
  const morningStay = selectedDay
    ? stays
        .filter(
          stay => stay.checkInDate < selectedDay.date && stay.checkOutDate >= selectedDay.date,
        )
        .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate))[0]
    : undefined;
  const sleepingStay = selectedDay
    ? stays
        .filter(
          stay => stay.checkInDate <= selectedDay.date && selectedDay.date < stay.checkOutDate,
        )
        .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate))[0]
    : undefined;
  // A stay that starts on this day belongs at the end of the timeline.
  // Only carry a hotel into the start of the day when it began earlier.
  const startStay = morningStay;
  const selectedDayDate = selectedDay?.date;
  const orderedSchedule = selectedDayDate
    ? orderScheduleItemsForDay(selectedSchedule, selectedDayDate)
    : [];
  const timelineEntries = [
    ...orderedSchedule.map((item, order) => ({
      kind: 'schedule' as const,
      item,
      order,
      sortTime: item.startTime ?? '',
    })),
    ...selectedFlights.flatMap(flight =>
      (['departure', 'arrival'] as const)
        .filter(event =>
          event === 'departure'
            ? flight.departureDate === selectedDayDate
            : flight.arrivalDate === selectedDayDate,
        )
        .map(event => {
          const sortTime = flightTime(
            event === 'arrival' ? flight.scheduledArrivalLocal : flight.scheduledDepartureLocal,
          );
          const nextTimedActivity = orderedSchedule.findIndex(
            item => item.startTime !== null && item.startTime >= sortTime,
          );
          return {
            kind: 'flight' as const,
            flight,
            event,
            // Flights fit before the next timed activity without changing the
            // relative order of itinerary activities.
            order: nextTimedActivity === -1 ? orderedSchedule.length : nextTimedActivity - 0.5,
            sortTime,
          };
        }),
    ),
  ].sort((a, b) => a.order - b.order || a.sortTime.localeCompare(b.sortTime));
  const showArrivalPlaceholder = isFirstDay && !hasArrivalFlight;
  const showDeparturePlaceholder = isLastDay && !hasDepartureFlight;
  const timelineCount =
    timelineEntries.length +
    (startStay ? 1 : 0) +
    (sleepingStay ? 1 : 0) +
    (showArrivalPlaceholder ? 1 : 0) +
    (showDeparturePlaceholder ? 1 : 0);

  async function toggleActivityLock(item: ScheduleItem) {
    setLockPendingId(item.id);
    try {
      await onToggleActivityLock(item);
    } finally {
      setLockPendingId(null);
    }
  }

  function updateDropTarget(next: ScheduleDropTarget | null) {
    dropTargetRef.current = next;
    setDropTarget(current =>
      current?.itemId === next?.itemId && current?.placement === next?.placement ? current : next,
    );
  }

  function beginDrag(itemId: string) {
    activityWasDragged.current = true;
    draggingItemIdRef.current = itemId;
    setDraggingItemId(itemId);
  }

  function clearDragState() {
    draggingItemIdRef.current = null;
    setDraggingItemId(null);
    updateDropTarget(null);
    window.setTimeout(() => {
      activityWasDragged.current = false;
    }, 0);
  }

  function handleCardDragStart(event: DragEvent<HTMLElement>, itemId: string) {
    const button = (event.target as HTMLElement).closest('button');
    if (button && !button.classList.contains(styles.scheduleDragHandle)) {
      event.preventDefault();
      return;
    }
    beginDrag(itemId);
    setTimelineDragPayload(event, { type: 'activity', itemId });
  }

  function handleCardDrop(event: DragEvent<HTMLElement>, targetId: string) {
    const payload = parseTimelineDragPayload(event);
    if (!payload || payload.type !== 'activity') return;
    event.preventDefault();
    event.stopPropagation();
    const placement = pointerPlacement(event.currentTarget, event.clientY);
    clearDragState();
    if (payload.itemId !== targetId) void onReorder(payload.itemId, targetId, placement);
  }

  function handleTouchDragMove(event: PointerEvent<HTMLButtonElement>) {
    const itemId = draggingItemIdRef.current;
    if (!itemId || event.pointerType === 'mouse') return;
    event.preventDefault();
    const card = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-schedule-item-id]');
    const targetId = card?.dataset.scheduleItemId;
    if (!card || !targetId || targetId === itemId) {
      updateDropTarget(null);
      return;
    }
    updateDropTarget({ itemId: targetId, placement: pointerPlacement(card, event.clientY) });
  }

  function handleTouchDragEnd(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' || !draggingItemIdRef.current) return;
    const itemId = draggingItemIdRef.current;
    const target = dropTargetRef.current;
    clearDragState();
    if (target && target.itemId !== itemId) {
      void onReorder(itemId, target.itemId, target.placement);
    }
  }

  return (
    <aside
      className={`${styles.dayPanel} ${mode === 'day' ? styles.mobileVisible : ''}`}
      data-enter
    >
      <div className={styles.panelHeader}>
        <div>
          <h1>{selectedDay ? `${selectedDay.label}, ${selectedDay.shortDate}` : 'No trip yet'}</h1>
          <p>
            {selectedDay ? (
              <>
                {destinationLabel ?? 'Your trip'} <span>·</span> {timelineEntries.length}{' '}
                {timelineEntries.length === 1 ? 'stop' : 'stops'}
              </>
            ) : (
              'Create a trip to start planning'
            )}
          </p>
        </div>
        <div className={styles.panelActions}>
          <button
            type="button"
            className={styles.dayNotesButton}
            onClick={onOpenDayNotes}
            disabled={!selectedDay}
            aria-label={selectedDay?.notes ? 'Edit day notes' : 'Open day notes'}
            title={selectedDay?.notes ? 'Edit day notes' : 'Day notes'}
          >
            <MessageSquareText size={16} />
          </button>
          <button
            type="button"
            className={styles.dayNotesButton}
            onClick={onOpenReminders}
            aria-label="Open personal reminders"
            title="Personal reminders"
          >
            <AlarmClock size={16} />
          </button>
        </div>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close day plan">
          <X size={16} />
        </button>
      </div>
      <div className={styles.timeline}>
        {timelineCount === 0 ? (
          <div className={styles.emptyDay}>
            <div className={styles.emptyIcon}>
              <Sparkles size={18} />
            </div>
            <strong>{selectedDay ? 'A blank page' : 'Nothing planned yet'}</strong>
            <p>
              {selectedDay
                ? 'Pick a place from your library, add an activity, or attach a flight.'
                : 'Search Google Maps to discover a place for your next trip.'}
            </p>
          </div>
        ) : (
          <>
            {showArrivalPlaceholder && (
              <TravelPlaceholder
                kind="arrival"
                onAdd={onOpenTravelDetails}
                hasNext={timelineCount > 1}
              />
            )}
            {startStay && (
              <StayTimelineItem stay={startStay} position="start" hasNext={timelineCount > 1} />
            )}
            {timelineEntries.map((entry, index) => {
              if (entry.kind === 'flight') {
                return (
                  <FlightTimelineItem
                    key={`${entry.flight.id}-${entry.event}`}
                    flight={entry.flight}
                    event={entry.event}
                    hasNext={index < timelineCount - 1}
                  />
                );
              }
              const item = entry.item;
              const place = places.find(candidate => candidate.id === item.savedPlaceId);
              if (!place && !item.title) return null;
              const category = item.category ?? place?.category ?? 'CUSTOM';
              const meta = categoryMeta[category];
              const color = place?.color ?? meta.color;
              const emoji = place?.emoji ?? meta.emoji;
              const title = place?.name ?? item.title ?? 'Activity';
              const scheduleIndex = orderedSchedule.findIndex(
                candidate => candidate.id === item.id,
              );
              const timelineIndex = (showArrivalPlaceholder ? 1 : 0) + (startStay ? 1 : 0) + index;
              return (
                <Fragment key={item.id}>
                  <div className={styles.scheduleTimelineItem}>
                    {item.startTime && (
                      <div className={styles.timelineMarker}>{item.startTime}</div>
                    )}
                    <div
                      className={`${styles.timelineItem} ${styles.timelineItemDraggable} ${draggingItemId === item.id ? styles.timelineItemDragging : ''} ${dropTarget?.itemId === item.id && dropTarget.placement === 'before' ? styles.timelineItemDropBefore : ''} ${dropTarget?.itemId === item.id && dropTarget.placement === 'after' ? styles.timelineItemDropAfter : ''} ${item.reservationLocked ? styles.timelineItemLocked : ''} ${place && selectedPlaceId === place.id ? styles.timelineItemSelected : ''} ${!place ? styles.timelineItemManual : ''}`}
                      data-schedule-item-id={item.id}
                      draggable
                      onClick={() => {
                        if (!activityWasDragged.current) onEdit(item);
                      }}
                      onDragStart={event => handleCardDragStart(event, item.id)}
                      onDragOver={event => {
                        const draggedId = draggingItemIdRef.current;
                        if (!draggedId || draggedId === item.id) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        updateDropTarget({
                          itemId: item.id,
                          placement: pointerPlacement(event.currentTarget, event.clientY),
                        });
                      }}
                      onDragLeave={event => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          updateDropTarget(null);
                        }
                      }}
                      onDrop={event => handleCardDrop(event, item.id)}
                      onDragEnd={clearDragState}
                    >
                      <div className={styles.timelineTrack}>
                        <div className={styles.timelineDot} style={{ backgroundColor: color }}>
                          {emoji}
                        </div>
                        {timelineIndex < timelineCount - 1 && (
                          <div className={styles.timelineLine} />
                        )}
                      </div>
                      <div className={styles.scheduleCard}>
                        <div className={styles.scheduleCardTop}>
                          <span className={styles.scheduleCardHeading}>
                            <button
                              type="button"
                              className={styles.scheduleDragHandle}
                              draggable
                              aria-label={`Reorder ${title}. Drag, or use the up and down arrow keys.`}
                              title="Drag to reorder"
                              onClick={event => event.stopPropagation()}
                              onKeyDown={event => {
                                if (event.key === 'ArrowUp' && scheduleIndex > 0) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void onReorder(
                                    item.id,
                                    orderedSchedule[scheduleIndex - 1].id,
                                    'before',
                                  );
                                } else if (
                                  event.key === 'ArrowDown' &&
                                  scheduleIndex < orderedSchedule.length - 1
                                ) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void onReorder(
                                    item.id,
                                    orderedSchedule[scheduleIndex + 1].id,
                                    'after',
                                  );
                                }
                              }}
                              onPointerDown={event => {
                                if (event.pointerType === 'mouse') return;
                                event.stopPropagation();
                                event.currentTarget.setPointerCapture(event.pointerId);
                                beginDrag(item.id);
                              }}
                              onPointerMove={handleTouchDragMove}
                              onPointerUp={handleTouchDragEnd}
                              onPointerCancel={clearDragState}
                            >
                              <GripVertical size={13} aria-hidden="true" />
                            </button>
                            <span
                              className={styles.categoryPill}
                              style={{ color, backgroundColor: `${color}18` }}
                            >
                              {emoji} {meta.label}
                            </span>
                          </span>
                          <span className={styles.scheduleCardActions}>
                            <ItemIndicators
                              kind="ACTIVITY"
                              itemId={item.id}
                              showReservationLock={false}
                            />
                            <button
                              type="button"
                              className={styles.activityRemoveButton}
                              onClick={event => {
                                event.stopPropagation();
                                onRemove(item.id);
                              }}
                              aria-label={`Remove ${title}`}
                              title="Remove from schedule"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.activityLockButton} ${item.reservationLocked ? styles.activityLockButtonActive : ''}`}
                              disabled={!canLockActivities || lockPendingId !== null}
                              aria-label={
                                item.reservationLocked ? `Unlock ${title}` : `Lock ${title}`
                              }
                              aria-pressed={Boolean(item.reservationLocked)}
                              title={
                                item.reservationLocked ? 'Unlock reservation' : 'Lock reservation'
                              }
                              onClick={event => {
                                event.stopPropagation();
                                void toggleActivityLock(item);
                              }}
                            >
                              {item.reservationLocked ? (
                                <Unlock size={13} aria-hidden="true" />
                              ) : (
                                <Lock size={13} aria-hidden="true" />
                              )}
                            </button>
                          </span>
                        </div>
                        <strong>{title}</strong>
                        <span>
                          {item.duration} min{item.note ? ' · note added' : ''}
                        </span>
                        {item.note?.trim() ? (
                          <div className={styles.cardControls}>
                            <button
                              disabled={!canCreateReminders}
                              onClick={event => {
                                event.stopPropagation();
                                onCreateReminder(item, title);
                              }}
                              aria-label={`Create a reminder from ${title}'s note`}
                              title={
                                canCreateReminders
                                  ? 'Create a personal reminder from this note'
                                  : 'Reconnect to create a reminder'
                              }
                            >
                              Remind
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {sleepingStay && <StayTimelineItem stay={sleepingStay} position="sleep" />}
            {showDeparturePlaceholder && (
              <TravelPlaceholder kind="departure" onAdd={onOpenTravelDetails} />
            )}
          </>
        )}
      </div>
      <button
        type="button"
        className={styles.addActivity}
        onClick={() => onOpenActivityEditor()}
        disabled={!selectedDay}
      >
        <Plus size={16} /> Add activity
      </button>
    </aside>
  );
}
