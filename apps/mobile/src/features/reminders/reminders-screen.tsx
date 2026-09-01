import { router } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { deleteReminder, updateReminder } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useReminderMutation, useTripReminders } from '@/features/reminders/use-trip-reminders';
import {
  cancelReminderNotification,
  enableReminderNotifications,
  reminderNotificationsAreEnabled,
  syncReminderNotification,
  syncTripReminderNotifications,
} from '@/features/reminders/reminder-notifications';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { messageFromError } from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

function dueLabel(remindAt: string, status: 'OPEN' | 'COMPLETED') {
  const overdue = isOverdue(remindAt, status);
  const date = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(remindAt));
  return `${overdue ? 'Overdue' : 'Due'} · ${date}`;
}

function isOverdue(remindAt: string, status: 'OPEN' | 'COMPLETED') {
  return status === 'OPEN' && new Date(remindAt).getTime() < Date.now();
}

export function RemindersScreen() {
  const { colors: themeColors } = useTheme();
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
  const [status, setStatus] = React.useState<'OPEN' | 'COMPLETED'>('OPEN');
  const [alertsEnabled, setAlertsEnabled] = React.useState<boolean | null>(null);
  const remindersQuery = useTripReminders(trip?.id ?? null, status);
  const { isOnline, mutation: statusMutation } = useReminderMutation(
    trip?.id ?? null,
    ({ reminderId, nextStatus }: { reminderId: string; nextStatus: 'OPEN' | 'COMPLETED' }) =>
      updateReminder(trip!.id, reminderId, { status: nextStatus }),
  );
  const { mutation: deleteMutation } = useReminderMutation(trip?.id ?? null, (reminderId: string) =>
    deleteReminder(trip!.id, reminderId),
  );

  React.useEffect(() => {
    void reminderNotificationsAreEnabled()
      .then(setAlertsEnabled)
      .catch(() => setAlertsEnabled(false));
  }, []);

  if (tripQuery.isLoading) return <LoadingState label="Loading reminders…" />;
  if (tripQuery.error)
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  if (!trip)
    return (
      <EmptyState title="No trip selected" detail="Choose a trip to view personal reminders." />
    );
  const tripId = trip.id;
  if (remindersQuery.isLoading) return <LoadingState label="Loading reminders…" />;
  if (remindersQuery.error) {
    return (
      <ErrorState
        message={messageFromError(remindersQuery.error)}
        onRetry={() => void remindersQuery.refetch()}
      />
    );
  }

  function confirmDelete(reminderId: string, title: string) {
    Alert.alert(`Delete ${title}?`, 'This removes the reminder permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void deleteMutation
            .mutateAsync(reminderId)
            .then(() => cancelReminderNotification(reminderId)),
      },
    ]);
  }

  async function enableAlerts() {
    const enabled = await enableReminderNotifications();
    setAlertsEnabled(enabled);
    if (enabled && status === 'OPEN') {
      await syncTripReminderNotifications(tripId, remindersQuery.data ?? []);
    }
  }

  async function updateStatus(reminderId: string, nextStatus: 'OPEN' | 'COMPLETED') {
    const reminder = await statusMutation.mutateAsync({ reminderId, nextStatus });
    await syncReminderNotification(reminder);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: space.xl }}
      style={{ backgroundColor: colors.background }}
    >
      <OfflineNotice visible={!isOnline} />
      <Text selectable style={{ color: themeColors.textMuted, lineHeight: 20 }}>
        These reminders are private to you and never appear in your collaborators’ trip data.
      </Text>
      {status === 'OPEN' && alertsEnabled === false ? (
        <Card style={{ gap: 9 }}>
          <Text selectable style={{ color: themeColors.text, fontWeight: '700' }}>
            Phone alerts are off
          </Text>
          <Text selectable style={{ color: themeColors.textMuted, lineHeight: 20 }}>
            Enable alerts to receive a Wayfare notification when each reminder is due.
          </Text>
          <Button onPress={() => void enableAlerts()} tone="secondary">
            Enable phone alerts
          </Button>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          onPress={() => setStatus('OPEN')}
          tone={status === 'OPEN' ? 'primary' : 'secondary'}
        >
          Open
        </Button>
        <Button
          onPress={() => setStatus('COMPLETED')}
          tone={status === 'COMPLETED' ? 'primary' : 'secondary'}
        >
          Completed
        </Button>
      </View>
      {remindersQuery.data?.length ? (
        remindersQuery.data.map(reminder => (
          <Card key={reminder.id} style={{ gap: 9 }}>
            <View style={{ gap: 3 }}>
              <Text selectable style={{ color: themeColors.text, fontSize: 17, fontWeight: '800' }}>
                {reminder.title}
              </Text>
              {reminder.body ? (
                <Text selectable style={{ color: themeColors.textMuted, lineHeight: 20 }}>
                  {reminder.body}
                </Text>
              ) : null}
              <Text
                selectable
                style={{
                  color: isOverdue(reminder.remindAt, reminder.status)
                    ? themeColors.danger
                    : themeColors.textMuted,
                  fontWeight: '700',
                }}
              >
                {dueLabel(reminder.remindAt, reminder.status)}
              </Text>
              <Text selectable style={{ color: themeColors.textMuted, fontSize: 13 }}>
                {reminder.sourceTitle}
                {!reminder.sourceAvailable ? ' · Original note no longer available' : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                disabled={!isOnline}
                onPress={() =>
                  router.push({
                    pathname: '/reminder-editor',
                    params: { reminderId: reminder.id, status: reminder.status },
                  })
                }
                tone="secondary"
              >
                Edit
              </Button>
              <Button
                disabled={!isOnline || statusMutation.isPending}
                loading={statusMutation.isPending}
                onPress={() =>
                  void updateStatus(reminder.id, reminder.status === 'OPEN' ? 'COMPLETED' : 'OPEN')
                }
                tone="secondary"
              >
                {reminder.status === 'OPEN' ? 'Complete' : 'Reopen'}
              </Button>
              <Button
                disabled={!isOnline || deleteMutation.isPending}
                loading={deleteMutation.isPending}
                onPress={() => confirmDelete(reminder.id, reminder.title)}
                tone="danger"
              >
                Delete
              </Button>
            </View>
          </Card>
        ))
      ) : (
        <EmptyState
          title={status === 'OPEN' ? 'No open reminders' : 'No completed reminders'}
          detail="Create one from a saved-place comment or itinerary note."
        />
      )}
    </ScrollView>
  );
}
