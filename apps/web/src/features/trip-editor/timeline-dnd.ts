import type { DragEvent } from 'react';

export type TimelineDragPayload =
  { type: 'place'; placeId: string } | { type: 'activity'; itemId: string };

export type TimelineDropPlacement = 'before' | 'after';

const TIMELINE_DRAG_TYPE = 'application/x-wayfare-timeline';

export function isTimelinePlaceDrag(event: DragEvent<HTMLElement>) {
  return event.dataTransfer.types.includes(TIMELINE_DRAG_TYPE);
}

export function parseTimelineDragPayload(event: DragEvent<HTMLElement>) {
  const value = event.dataTransfer.getData(TIMELINE_DRAG_TYPE);
  if (!value) return null;

  try {
    return JSON.parse(value) as TimelineDragPayload;
  } catch {
    return null;
  }
}

export function setTimelineDragPayload(
  event: DragEvent<HTMLElement>,
  payload: TimelineDragPayload,
) {
  event.dataTransfer.effectAllowed = payload.type === 'place' ? 'copy' : 'move';
  event.dataTransfer.setData(TIMELINE_DRAG_TYPE, JSON.stringify(payload));
}

export function reorderTimelineItems<T extends { id: string }>(
  items: readonly T[],
  draggedId: string,
  targetId: string,
  placement: TimelineDropPlacement,
) {
  const draggedIndex = items.findIndex(item => item.id === draggedId);
  if (draggedIndex < 0 || draggedId === targetId) return [...items];

  const reordered = [...items];
  const [dragged] = reordered.splice(draggedIndex, 1);
  const targetIndex = reordered.findIndex(item => item.id === targetId);
  if (targetIndex < 0) return [...items];

  reordered.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, dragged);
  return reordered;
}
