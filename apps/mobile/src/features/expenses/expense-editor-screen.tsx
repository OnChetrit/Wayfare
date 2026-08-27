import AddIcon from '@expo/material-symbols/add.xml';
import CheckIcon from '@expo/material-symbols/check.xml';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { expenseCategories, type ExpenseCategory } from '@wayfare/domain';
import { createExpense, deleteExpense, updateExpense } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import {
  applyExpenseSource,
  expenseCategoryLabels,
  expenseSourcesForTrip,
  isExpenseSourceKind,
  newExpenseForm,
  type ExpenseEditorValues,
} from '@/features/expenses/expense-insights';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { messageFromError } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

const categories = expenseCategories.map(category => ({
  label: expenseCategoryLabels[category],
  value: category,
}));

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function ExpenseEditorScreen() {
  const {
    expenseId: rawExpenseId,
    sourceId: rawSourceId,
    sourceKind: rawSourceKind,
  } = useLocalSearchParams<{
    expenseId?: string | string[];
    sourceId?: string | string[];
    sourceKind?: string | string[];
  }>();
  const expenseId = first(rawExpenseId);
  const sourceId = first(rawSourceId);
  const sourceKind = first(rawSourceKind);
  const tripQuery = useTripEditor();
  if (tripQuery.isLoading) return <LoadingState label="Loading expense…" />;
  if (tripQuery.error)
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  if (!tripQuery.data)
    return (
      <EmptyState
        title="No trip selected"
        detail="Choose a trip before adding an expense."
        action={<Button onPress={() => router.replace('/trip-form')}>Create trip</Button>}
      />
    );
  return (
    <ExpenseEditor
      expenseId={expenseId}
      initialSourceId={sourceId}
      initialSourceKind={isExpenseSourceKind(sourceKind) ? sourceKind : undefined}
      trip={tripQuery.data}
    />
  );
}

function ExpenseEditor({
  trip,
  expenseId,
  initialSourceId,
  initialSourceKind,
}: {
  trip: NonNullable<ReturnType<typeof useTripEditor>['data']>;
  expenseId?: string;
  initialSourceId?: string;
  initialSourceKind?: 'flight' | 'schedule' | 'stay';
}) {
  const expense = trip.expenses.find(item => item.id === expenseId);
  const isManagedExpense = Boolean(expense?.stayId || expense?.flightId);
  const sources = expenseSourcesForTrip(trip);
  const [form, setForm] = React.useState<ExpenseEditorValues>(() => {
    const sourceKind = expense?.stayId
      ? 'stay'
      : expense?.flightId
        ? 'flight'
        : expense?.scheduleItemId
          ? 'schedule'
          : 'none';
    if (expense) {
      return {
        title: expense?.title ?? '',
        category: expense?.category ?? ('OTHER' as ExpenseCategory),
        amount: String(expense.amount),
        currency: expense?.currency ?? trip.defaultCurrency,
        expenseDate: expense?.expenseDate ?? trip.startDate,
        notes: expense?.notes ?? '',
        sourceKind,
        sourceId: expense?.stayId ?? expense?.flightId ?? expense?.scheduleItemId ?? '',
      };
    }
    const initialSource = initialSourceKind
      ? sources.find(source => source.kind === initialSourceKind && source.id === initialSourceId)
      : undefined;
    return newExpenseForm(trip, initialSource);
  });
  const [message, setMessage] = React.useState<string | null>(null);
  const { isOnline, mutation: saveMutation } = useTripMutation(trip.id, async () => {
    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount < 0)
      throw new Error('Enter a title and valid amount.');
    const source =
      form.sourceKind === 'stay'
        ? { stayId: form.sourceId || null }
        : form.sourceKind === 'flight'
          ? { flightId: form.sourceId || null }
          : form.sourceKind === 'schedule'
            ? { scheduleItemId: form.sourceId || null }
            : {};
    const input = {
      title: form.title.trim(),
      category: form.category,
      amount,
      currency: form.currency.toUpperCase(),
      expenseDate: form.expenseDate,
      notes: form.notes.trim() || undefined,
      ...source,
    };
    return expense ? updateExpense(trip.id, expense.id, input) : createExpense(trip.id, input);
  });
  const { mutation: deleteMutation } = useTripMutation(trip.id, () =>
    deleteExpense(trip.id, expense!.id),
  );
  const sourceOptions =
    form.sourceKind === 'none' ? [] : sources.filter(source => source.kind === form.sourceKind);
  async function save() {
    setMessage(null);
    try {
      await saveMutation.mutateAsync(undefined);
      router.back();
    } catch (error) {
      setMessage(messageFromError(error));
    }
  }
  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: 36 }}
        style={{ backgroundColor: colors.background }}
      >
        <OfflineNotice visible={!isOnline} />
        <Field
          label="Title"
          value={form.title}
          onChangeText={title => setForm(current => ({ ...current, title }))}
        />
        <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
          Category
        </Text>
        <ChipGroup
          options={categories}
          value={form.category}
          onChange={category => setForm(current => ({ ...current, category }))}
        />
        <Field
          label="Amount"
          keyboardType="decimal-pad"
          value={form.amount}
          onChangeText={amount => setForm(current => ({ ...current, amount }))}
        />
        <Field
          label="Currency"
          autoCapitalize="characters"
          maxLength={3}
          value={form.currency}
          onChangeText={currency => setForm(current => ({ ...current, currency }))}
        />
        <Field
          label="Date (YYYY-MM-DD)"
          value={form.expenseDate}
          onChangeText={expenseDate => setForm(current => ({ ...current, expenseDate }))}
        />
        <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
          Link expense to
        </Text>
        <ChipGroup
          options={[
            { label: 'Nothing', value: 'none' },
            { label: 'Stay', value: 'stay' },
            { label: 'Flight', value: 'flight' },
            { label: 'Itinerary item', value: 'schedule' },
          ]}
          value={form.sourceKind}
          onChange={sourceKind => setForm(current => ({ ...current, sourceKind, sourceId: '' }))}
        />
        {form.sourceKind !== 'none' ? (
          <View style={{ gap: 8 }}>
            {sourceOptions.map(option => (
              <Button
                key={option.id}
                onPress={() => setForm(current => applyExpenseSource(current, option))}
                tone={form.sourceId === option.id ? 'primary' : 'secondary'}
              >
                {option.title}
              </Button>
            ))}
          </View>
        ) : null}
        <Field
          label="Notes"
          multiline
          value={form.notes}
          onChangeText={notes => setForm(current => ({ ...current, notes }))}
        />
        {expense && !isManagedExpense ? (
          <Button
            disabled={!isOnline || deleteMutation.isPending}
            loading={deleteMutation.isPending}
            onPress={() =>
              Alert.alert('Delete this expense?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    void deleteMutation.mutateAsync(undefined).then(() => router.back()),
                },
              ])
            }
            tone="danger"
          >
            Delete expense
          </Button>
        ) : null}
        {expense && isManagedExpense ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
            This expense is managed with its linked stay or flight. Edit or remove that itinerary
            item to update it.
          </Text>
        ) : null}
        {message || saveMutation.error || deleteMutation.error ? (
          <Text selectable style={{ color: colors.danger }}>
            {message ?? messageFromError(saveMutation.error ?? deleteMutation.error)}
          </Text>
        ) : null}
      </ScrollView>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={expense ? 'Save expense changes' : 'Add expense'}
          disabled={!isOnline || saveMutation.isPending}
          icon={process.env.EXPO_OS === 'ios' ? undefined : expense ? CheckIcon : AddIcon}
          onPress={() => void save()}
          variant="done"
        >
          {expense ? 'Save' : 'Add'}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
