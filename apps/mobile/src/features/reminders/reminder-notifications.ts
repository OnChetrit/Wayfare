import type { Reminder } from '@wayfare/domain';
import { router } from 'expo-router';
import * as React from 'react';

import {
  isReminderNotificationData,
  isUpcomingOpenReminder,
  reminderNotificationBody,
  reminderNotificationData,
  reminderNotificationTitle,
  reminderNotificationUrl,
} from './reminder-notification-content';

type NotificationsModule = typeof import('expo-notifications');
type Notification = import('expo-notifications').Notification;
type NotificationPermissionsStatus = import('expo-notifications').NotificationPermissionsStatus;

const reminderChannelId = 'reminders';
let notificationsModulePromise: Promise<NotificationsModule | null> | undefined;

function isNativePlatform() {
  return process.env.EXPO_OS !== 'web';
}

/**
 * Keeps an older development client usable when it does not yet contain
 * expo-notifications. A newly built client resolves this module normally.
 */
async function getNotificationsModule() {
  if (!isNativePlatform()) return null;

  notificationsModulePromise ??= import('expo-notifications')
    .then(notifications => {
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      return notifications;
    })
    .catch(() => null);
  return notificationsModulePromise;
}

async function configureReminderChannel(notifications: NotificationsModule) {
  if (process.env.EXPO_OS !== 'android') return;

  await notifications.setNotificationChannelAsync(reminderChannelId, {
    description: 'Personal reminders scheduled in Wayfare',
    importance: notifications.AndroidImportance.HIGH,
    name: 'Reminders',
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

function permissionAllowsNotifications(
  permission: NotificationPermissionsStatus,
  notifications: NotificationsModule,
) {
  if (process.env.EXPO_OS === 'ios') {
    return (
      permission.ios?.status === notifications.IosAuthorizationStatus.AUTHORIZED ||
      permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL ||
      permission.ios?.status === notifications.IosAuthorizationStatus.EPHEMERAL
    );
  }
  return permission.granted;
}

export async function reminderNotificationsAreEnabled() {
  const notifications = await getNotificationsModule();
  if (!notifications) return false;
  return permissionAllowsNotifications(await notifications.getPermissionsAsync(), notifications);
}

/** Requests system permission only after a person explicitly enables reminder alerts. */
export async function enableReminderNotifications() {
  const notifications = await getNotificationsModule();
  if (!notifications) return false;
  await configureReminderChannel(notifications);

  let permission = await notifications.getPermissionsAsync();
  if (!permissionAllowsNotifications(permission, notifications) && permission.canAskAgain) {
    permission = await notifications.requestPermissionsAsync();
  }
  return permissionAllowsNotifications(permission, notifications);
}

async function scheduledReminderRequests(notifications: NotificationsModule) {
  return (await notifications.getAllScheduledNotificationsAsync()).filter(request =>
    isReminderNotificationData(request.content.data),
  );
}

async function cancelScheduledReminderNotification(
  notifications: NotificationsModule,
  reminderId: string,
) {
  const scheduled = await scheduledReminderRequests(notifications);
  await Promise.all(
    scheduled
      .flatMap(request => {
        const data = request.content.data;
        return isReminderNotificationData(data) && data.reminderId === reminderId
          ? [request.identifier]
          : [];
      })
      .map(identifier => notifications.cancelScheduledNotificationAsync(identifier)),
  );
}

export async function cancelReminderNotification(reminderId: string) {
  const notifications = await getNotificationsModule();
  if (!notifications) return;
  await cancelScheduledReminderNotification(notifications, reminderId);
}

async function scheduleReminderNotification(
  notifications: NotificationsModule,
  reminder: Reminder,
) {
  await notifications.scheduleNotificationAsync({
    content: {
      body: reminderNotificationBody(reminder),
      data: reminderNotificationData(reminder),
      sound: 'default',
      title: reminderNotificationTitle(reminder),
    },
    trigger: {
      channelId: reminderChannelId,
      date: new Date(reminder.remindAt),
      type: notifications.SchedulableTriggerInputTypes.DATE,
    },
  });
}

/** Keeps one OS-level notification per upcoming open reminder on this device. */
export async function syncReminderNotification(reminder: Reminder) {
  const notifications = await getNotificationsModule();
  if (!notifications || !(await reminderNotificationsAreEnabled())) return false;
  await configureReminderChannel(notifications);
  await cancelScheduledReminderNotification(notifications, reminder.id);
  if (isUpcomingOpenReminder(reminder)) await scheduleReminderNotification(notifications, reminder);
  return true;
}

/** Removes stale notifications for this trip and refreshes the current open reminders. */
export async function syncTripReminderNotifications(tripId: string, reminders: Reminder[]) {
  const notifications = await getNotificationsModule();
  if (!notifications || !(await reminderNotificationsAreEnabled())) return false;
  await configureReminderChannel(notifications);

  const upcoming = reminders.filter(isUpcomingOpenReminder);
  const scheduled = await scheduledReminderRequests(notifications);
  await Promise.all(
    scheduled
      .filter(
        request =>
          isReminderNotificationData(request.content.data) &&
          request.content.data.tripId === tripId,
      )
      .map(request => notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
  await Promise.all(
    upcoming.map(reminder => scheduleReminderNotification(notifications, reminder)),
  );
  return true;
}

function notificationUrl(data: unknown) {
  return isReminderNotificationData(data) ? data.url : null;
}

/** Opens the personal reminders list when someone taps a Wayfare reminder alert. */
export function useReminderNotificationNavigation() {
  React.useEffect(() => {
    let subscription: { remove: () => void } | undefined;

    function openReminder(notification: Notification) {
      const url = notificationUrl(notification.request.content.data);
      if (url === reminderNotificationUrl) router.push(url);
    }

    void getNotificationsModule().then(notifications => {
      if (!notifications) return;

      const lastResponse = notifications.getLastNotificationResponse();
      if (lastResponse?.notification) openReminder(lastResponse.notification);

      subscription = notifications.addNotificationResponseReceivedListener(response => {
        openReminder(response.notification);
      });
    });

    return () => subscription?.remove();
  }, []);
}
