import {
  CalendarDays,
  Check,
  Clock3,
  Columns3,
  GripVertical,
  MapPin,
  MessageSquareText,
  Plane,
  Plus,
  Rows3,
  Trash2,
} from 'lucide-react';
import { useState, type DragEvent } from 'react';
import styles from './TimelineView.module.scss';
import { categoryMeta } from './data';
import { parseTimelineDragPayload, setTimelineDragPayload } from './timeline-dnd';
import { flightTime } from '@/lib/trips/flights';
import type { SavedPlace, ScheduleItem, TripDay, TripFlight } from './types';

type TimelineViewProps = {
  days: TripDay[];
  schedule: ScheduleItem[];
  flights: TripFlight[];
  places: SavedPlace[];
  selectedDate: string;
  selectedPlaceId: string | null;
  destinationLabel?: string | null;
  onSelectDay: (date: string) => void;
  onSelectPlace: (place: SavedPlace) => void;
  onMoveActivity: (itemId: string, date: string) => void;
  onRemoveActivity: (itemId: string) => void;
  onAddPlaceToDay: (place: SavedPlace, date: string) => void;
  onAddActivity: (date: string) => void;
  onOpenDayNotes: (date: string) => void;
};

function formatDayDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatShortDayDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function TimelineView({
  days,
  schedule,
  flights,
  places,
  selectedDate,
  selectedPlaceId,
  destinationLabel,
  onSelectDay,
  onSelectPlace,
  onMoveActivity,
  onRemoveActivity,
  onAddPlaceToDay,
  onAddActivity,
  onOpenDayNotes,
}: TimelineViewProps) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [timelineLayout, setTimelineLayout] = useState<'vertical' | 'horizontal'>('vertical');

  function handleDrop(event: DragEvent<HTMLElement>, date: string) {
    event.preventDefault();
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

  return (
    <section className={styles.timelineView} data-enter aria-label="Trip timeline">
      <div className={styles.timelineHeader}>
        <div>
          <h1>{destinationLabel ?? 'Your trip'} at a glance</h1>
          <p>Drag activities between days, or pull a saved place into the day you want to visit.</p>
        </div>
        <div className={styles.timelineHeaderTools}>
          <div className={styles.timelineSummary}>
            <span>{days.length} days</span>
            <span>{schedule.length + flights.length * 2} activities</span>
          </div>
          <div className={styles.timelineLayoutToggle} role="group" aria-label="Timeline layout">
            <button
              type="button"
              className={timelineLayout === 'vertical' ? styles.timelineLayoutActive : ''}
              aria-pressed={timelineLayout === 'vertical'}
              onClick={() => setTimelineLayout('vertical')}
            >
              <Rows3 size={13} /> Vertical
            </button>
            <button
              type="button"
              className={timelineLayout === 'horizontal' ? styles.timelineLayoutActive : ''}
              aria-pressed={timelineLayout === 'horizontal'}
              onClick={() => setTimelineLayout('horizontal')}
            >
              <Columns3 size={13} /> Horizontal
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${styles.timelineScroll} ${timelineLayout === 'horizontal' ? styles.timelineScrollHorizontal : ''}`}
      >
        {days.map((day, index) => {
          const dayActivities = [
            ...schedule
              .filter(item => item.date === day.date)
              .map(item => ({ kind: 'schedule' as const, item, sortTime: item.startTime })),
            ...flights.flatMap(flight =>
              (['departure', 'arrival'] as const)
                .filter(event =>
                  event === 'departure'
                    ? flight.departureDate === day.date
                    : flight.arrivalDate === day.date,
                )
                .map(event => ({
                  kind: 'flight' as const,
                  flight,
                  event,
                  sortTime: flightTime(
                    event === 'arrival'
                      ? flight.scheduledArrivalLocal
                      : flight.scheduledDepartureLocal,
                  ),
                })),
            ),
          ].sort((a, b) => a.sortTime.localeCompare(b.sortTime));
          const isDropTarget = dragOverDate === day.date;
          const isSelected = selectedDate === day.date;

          return (
            <article
              key={day.id}
              className={`${styles.daySection} ${timelineLayout === 'horizontal' ? styles.daySectionHorizontal : ''} ${isSelected ? styles.daySectionSelected : ''} ${isDropTarget ? styles.daySectionDropTarget : ''}`}
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
            >
              <div className={styles.dayRail} aria-hidden="true">
                <span className={styles.dayRailDot}>
                  {isSelected ? <Check size={12} /> : index + 1}
                </span>
                {index < days.length - 1 && <span className={styles.dayRailLine} />}
              </div>
              <div className={styles.dayContent}>
                <header className={styles.dayHeader}>
                  <button
                    type="button"
                    className={styles.dayHeadingButton}
                    onClick={() => {
                      onSelectDay(day.date);
                    }}
                  >
                    <span className={styles.dayKicker}>{day.label}</span>
                    <strong>{formatDayDate(day.date)}</strong>
                  </button>
                  <div className={styles.dayActions}>
                    <span className={styles.activityCount}>
                      {dayActivities.length}{' '}
                      {dayActivities.length === 1 ? 'activity' : 'activities'}
                    </span>
                    <button
                      type="button"
                      className={styles.dayActionButton}
                      onClick={() => onOpenDayNotes(day.date)}
                      aria-label={`Open notes for ${day.label}, ${formatShortDayDate(day.date)}`}
                      title="Day notes"
                    >
                      <MessageSquareText size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.dayActionButton}
                      onClick={() => onAddActivity(day.date)}
                      aria-label={`Add activity to ${day.label}, ${formatShortDayDate(day.date)}`}
                      title="Add activity"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </header>
                {day.notes && (
                  <button
                    type="button"
                    className={styles.dayNote}
                    onClick={() => onOpenDayNotes(day.date)}
                  >
                    <MessageSquareText size={13} />
                    <span>{day.notes}</span>
                  </button>
                )}
                <div className={styles.activityList}>
                  {dayActivities.map(activity => {
                    if (activity.kind === 'flight') {
                      const { flight } = activity;
                      const departure =
                        flight.departureAirportIata ?? flight.departureAirportName ?? 'Departure';
                      const arrival =
                        flight.arrivalAirportIata ?? flight.arrivalAirportName ?? 'Arrival';
                      const isArrival = activity.event === 'arrival';
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
                        isArrival && flight.arrivalBaggageBelt
                          ? `Baggage ${flight.arrivalBaggageBelt}`
                          : undefined,
                      ]
                        .filter(Boolean)
                        .map(detail => String(detail));

                      return (
                        <article
                          key={`${flight.id}-${activity.event}`}
                          className={`${styles.activityCard} ${styles.flightCard} ${isArrival ? styles.flightArrival : styles.flightDeparture}`}
                        >
                          <span className={styles.flightSpacer} aria-hidden="true" />
                          <span className={styles.activityTime}>
                            <Clock3 size={12} />{' '}
                            {flightTime(
                              isArrival
                                ? flight.scheduledArrivalLocal
                                : flight.scheduledDepartureLocal,
                            )}
                          </span>
                          <span className={styles.activityIcon}>
                            <Plane
                              size={16}
                              className={
                                isArrival ? styles.flightPlaneArrival : styles.flightPlaneDeparture
                              }
                            />
                          </span>
                          <div className={styles.activityDetails}>
                            <strong>
                              {isArrival
                                ? `${arrival} ← ${departure}`
                                : `${departure} → ${arrival}`}
                            </strong>
                            {flightDetails.length > 0 && (
                              <div className={styles.flightDetails}>
                                {flightDetails.map((detail, index) => (
                                  <span
                                    key={`${detail}-${index}`}
                                    className={styles.flightDetailTag}
                                  >
                                    {detail}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className={styles.flightLabel}>
                            {isArrival ? 'Flight arrival' : 'Flight departure'}
                          </span>
                        </article>
                      );
                    }

                    const { item } = activity;
                    const place = places.find(candidate => candidate.id === item.savedPlaceId);
                    const category = item.category ?? place?.category ?? 'CUSTOM';
                    const meta = categoryMeta[category];
                    const color = place?.color ?? meta.color;
                    const title = place?.name ?? item.title ?? 'Activity';

                    return (
                      <article
                        key={item.id}
                        className={`${styles.activityCard} ${place && selectedPlaceId === place.id ? styles.activityCardSelected : ''}`}
                        draggable
                        onDragStart={event =>
                          setTimelineDragPayload(event, { type: 'activity', itemId: item.id })
                        }
                        onDragEnd={() => setDragOverDate(null)}
                      >
                        <span className={styles.dragHandle} aria-hidden="true">
                          <GripVertical size={15} />
                        </span>
                        <span className={styles.activityTime}>
                          <Clock3 size={12} /> {item.startTime}
                        </span>
                        <span
                          className={styles.activityIcon}
                          style={{ backgroundColor: `${color}18`, color }}
                        >
                          {place?.emoji ?? meta.emoji}
                        </span>
                        <button
                          type="button"
                          className={styles.activityDetails}
                          onClick={() => {
                            onSelectDay(day.date);
                            if (place) onSelectPlace(place);
                          }}
                        >
                          <strong>{title}</strong>
                          <span>
                            {meta.label} · {item.duration} min{item.note ? ' · note added' : ''}
                          </span>
                        </button>
                        {place && (
                          <span className={styles.placeMarker} title={place.subtitle}>
                            <MapPin size={13} />
                          </span>
                        )}
                        <button
                          type="button"
                          className={styles.activityRemove}
                          onClick={event => {
                            event.stopPropagation();
                            onRemoveActivity(item.id);
                          }}
                          aria-label={`Remove ${title} from ${day.label}`}
                          title="Remove from day"
                        >
                          <Trash2 size={13} />
                        </button>
                      </article>
                    );
                  })}
                  {dayActivities.length === 0 && (
                    <div
                      className={`${styles.emptyDay} ${isDropTarget ? styles.emptyDayDropTarget : ''}`}
                    >
                      <CalendarDays size={16} />
                      <span>Drop a saved place here to start this day</span>
                    </div>
                  )}
                </div>
                {isDropTarget && dayActivities.length > 0 && (
                  <div className={styles.dropHint}>Release to move it to this day</div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
