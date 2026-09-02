import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { createReminder, updateReminder } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import {
  localReminderDateTime,
  reminderInputFromForm,
  reminderUtcFromLocal,
  type ReminderSource,
} from '@/features/reminders/reminder-form';
import {
  reminderById,
  useReminderMutation,
  useTripReminders,
} from '@/features/reminders/use-trip-reminders';
import {
  enableReminderNotifications,
  syncReminderNotification,
} from '@/features/reminders/reminder-notifications';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { messageFromError } from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function defaultReminderTime() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return localReminderDateTime(date.toISOString());
}

export function ReminderEditorSheet() {
  useTheme();
  const params = useLocalSearchParams<{
    reminderId?: string | string[];
    savedPlaceId?: string | string[];
    scheduleItemId?: string | string[];
    sourceBody?: string | string[];
    sourceKind?: string | string[];
    sourceTitle?: string | string[];
    remindAtLocal?: string | string[];
    status?: string | string[];
  }>();
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
  const reminderId = first(params.reminderId);
  const status = first(params.status) === 'COMPLETED' ? 'COMPLETED' : 'OPEN';
  const remindersQuery = useTripReminders(trip?.id ?? null, status);
  const reminder = reminderById(remindersQuery.data, reminderId);

  if (tripQuery.isLoading) return <LoadingState label="Loading reminder…" />;
  if (tripQuery.error)
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  if (!trip)
    return (
      <EmptyState title="No trip selected" detail="Choose a trip before creating a reminder." />
    );
  if (reminderId && remindersQuery.isLoading) return <LoadingState label="Loading reminder…" />;
  if (reminderId && remindersQuery.error) {
    return (
      <ErrorState
        message={messageFromError(remindersQuery.error)}
        onRetry={() => void remindersQuery.refetch()}
      />
    );
  }
  if (reminderId && !reminder) {
    return <EmptyState title="Reminder not found" detail="It may have been removed." />;
  }

  const sourceKind = first(params.sourceKind);
  const source: ReminderSource | null = reminder
    ? null
    : sourceKind === 'SAVED_PLACE' && first(params.savedPlaceId)
      ? { sourceKind, savedPlaceId: first(params.savedPlaceId)! }
      : sourceKind === 'SCHEDULE_ITEM' && first(params.scheduleItemId)
        ? { sourceKind, scheduleItemId: first(params.scheduleItemId)! }
        : null;
  if (!reminder && !source) {
    return (
      <ErrorState message="Choose a saved comment or itinerary note before creating a reminder." />
    );
  }

  return (
    <ReminderEditor
      reminder={reminder}
      source={source}
      sourceBody={first(params.sourceBody) ?? ''}
      sourceTitle={first(params.sourceTitle) ?? ''}
      initialRemindAtLocal={first(params.remindAtLocal)}
      tripId={trip.id}
    />
  );
}

function ReminderEditor({
  reminder,
  source,
  sourceBody,
  sourceTitle,
  initialRemindAtLocal,
  tripId,
}: {
  reminder: ReturnType<typeof reminderById>;
  source: ReminderSource | null;
  sourceBody: string;
  sourceTitle: string;
  initialRemindAtLocal?: string;
  tripId: string;
}) {
  const { colors: themeColors } = useTheme();
  const [title, setTitle] = React.useState(reminder?.title ?? sourceTitle);
  const [body, setBody] = React.useState(reminder?.body ?? sourceBody);
  const originalTime = reminder
    ? localReminderDateTime(reminder.remindAt)
    : (initialRemindAtLocal ?? defaultReminderTime());
  const [remindAtLocal, setRemindAtLocal] = React.useState(originalTime);
  const [message, setMessage] = React.useState<string | null>(null);
  const { isOnline, mutation } = useReminderMutation(tripId, async () => {
    if (reminder) {
      const remindAt = reminderUtcFromLocal(remindAtLocal);
      if (!remindAt) throw new Error('Use a valid local date and time.');
      return updateReminder(tripId, reminder.id, {
        title,
        body,
        ...(remindAtLocal === originalTime ? {} : { remindAt }),
      });
    }
    const result = reminderInputFromForm(source!, { title, body, remindAtLocal });
    if ('error' in result) throw new Error(result.error);
    return createReminder(tripId, result.data);
  });

  async function save() {
    setMessage(null);
    try {
      const canNotify = await enableReminderNotifications();
      const savedReminder = await mutation.mutateAsync(undefined);
      const notificationScheduled = canNotify && (await syncReminderNotification(savedReminder));
      if (!notificationScheduled) {
        Alert.alert(
          'Reminder saved',
          'Phone alerts are off. Enable Wayfare notifications in your device settings to receive this reminder.',
        );
      }
      router.back();
    } catch (error) {
      setMessage(messageFromError(error, 'Could not save this reminder.'));
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <OfflineNotice visible={!isOnline} />
      <View style={{ gap: 3 }}>
        <Text selectable style={{ color: themeColors.text, fontSize: 16, fontWeight: '800' }}>
          {reminder ? reminder.sourceTitle : sourceTitle}
        </Text>
        <Text selectable style={{ color: themeColors.textMuted, lineHeight: 20 }}>
          This reminder is private to you. Editing it never changes the shared note.
        </Text>
        <Text selectable style={{ color: themeColors.textMuted, lineHeight: 20 }}>
          Wayfare will ask to send a phone alert at the selected time.
        </Text>
      </View>
      {reminder ? (
        <Field label="Reminder title" value={title} onChangeText={setTitle} maxLength={200} />
      ) : null}
      <Field label="Message" multiline value={body} onChangeText={setBody} maxLength={5000} />
      <Field
        label="Reminder time (your local time, YYYY-MM-DD HH:mm)"
        value={remindAtLocal}
        onChangeText={setRemindAtLocal}
        placeholder="2026-10-12 09:00"
      />
      {message ? (
        <Text selectable style={{ color: themeColors.danger }}>
          {message}
        </Text>
      ) : null}
      <Button
        disabled={!isOnline || mutation.isPending}
        loading={mutation.isPending}
        onPress={() => void save()}
      >
        {reminder ? 'Save reminder' : 'Create reminder'}
      </Button>
    </ScrollView>
  );
}
