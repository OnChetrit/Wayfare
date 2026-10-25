import type { ScheduleItem } from '@wayfare/domain';

export function canModifyActivity(
  item: Pick<ScheduleItem, 'reservationLocked'>,
  options: { canEdit: boolean; isOnline: boolean; pending?: boolean },
) {
  return !item.reservationLocked && canReorderActivity(options);
}

export function canReorderActivity(options: {
  canEdit: boolean;
  isOnline: boolean;
  pending?: boolean;
}) {
  return options.canEdit && options.isOnline && !Boolean(options.pending);
}
