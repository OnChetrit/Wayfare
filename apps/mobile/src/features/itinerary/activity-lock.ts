import type { ScheduleItem } from '@wayfare/domain';

export function canModifyActivity(
  item: Pick<ScheduleItem, 'reservationLocked'>,
  options: { canEdit: boolean; isOnline: boolean; pending?: boolean },
) {
  return (
    !item.reservationLocked && options.canEdit && options.isOnline && !Boolean(options.pending)
  );
}
