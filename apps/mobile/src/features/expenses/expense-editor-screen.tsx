import AddIcon from '@expo/material-symbols/add.xml';
import CheckIcon from '@expo/material-symbols/check.xml';
import {
  Button as SwiftButton,
  ConfirmationDialog,
  DatePicker,
  Form,
  Host,
  Label,
  Picker,
  Section,
  Text as SwiftText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  datePickerStyle,
  disabled,
  foregroundStyle,
  keyboardType,
  lineLimit,
  pickerStyle,
  scrollDismissesKeyboard,
  tag,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { expenseCategories, type ExpenseCategory } from '@wayfare/domain';
import { createExpense, deleteExpense, updateExpense } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/controls';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Field } from '@/components/ui/field';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import {
  applyExpenseSource,
  expenseCategoryLabels,
  expenseSourcesForTrip,
  isExpenseSourceKind,
  newExpenseForm,
  type ExpenseSource,
  type ExpenseEditorValues,
} from '@/features/expenses/expense-insights';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { dateTimeFieldValue, dateTimePickerDate } from '@/components/ui/date-time-field-value';
import { currencyOptions } from '@/lib/account-preferences';
import { messageFromError } from '@/lib/format';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

const categories = expenseCategories.map(category => ({
  label: expenseCategoryLabels[category],
  value: category,
}));

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function ExpenseEditorScreen() {
  useTheme();
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
  const { colors, theme } = useTheme();
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
  const [isDeleteConfirmationPresented, setIsDeleteConfirmationPresented] = React.useState(false);
  const nativeTitle = useNativeState(form.title);
  const nativeAmount = useNativeState(form.amount);
  const nativeNotes = useNativeState(form.notes);
  const { isOnline, mutation: saveMutation } = useTripMutation(trip.id, async () => {
    const currentForm =
      process.env.EXPO_OS === 'ios'
        ? {
            ...form,
            amount: nativeAmount.get(),
            notes: nativeNotes.get(),
            title: nativeTitle.get(),
          }
        : form;
    const amount = Number(currentForm.amount);
    if (!currentForm.title.trim() || !Number.isFinite(amount) || amount < 0)
      throw new Error('Enter a title and valid amount.');
    const source =
      currentForm.sourceKind === 'stay'
        ? { stayId: currentForm.sourceId || null }
        : currentForm.sourceKind === 'flight'
          ? { flightId: currentForm.sourceId || null }
          : currentForm.sourceKind === 'schedule'
            ? { scheduleItemId: currentForm.sourceId || null }
            : {};
    const input = {
      title: currentForm.title.trim(),
      category: currentForm.category,
      amount,
      currency: currentForm.currency.toUpperCase(),
      expenseDate: currentForm.expenseDate,
      notes: currentForm.notes.trim() || undefined,
      ...source,
    };
    return expense ? updateExpense(trip.id, expense.id, input) : createExpense(trip.id, input);
  });
  const { mutation: deleteMutation } = useTripMutation(trip.id, () =>
    deleteExpense(trip.id, expense!.id),
  );
  const sourceOptions =
    form.sourceKind === 'none' ? [] : sources.filter(source => source.kind === form.sourceKind);
  const isFormDisabled = !isOnline || saveMutation.isPending;
  const formError =
    message ||
    (saveMutation.error || deleteMutation.error
      ? messageFromError(saveMutation.error ?? deleteMutation.error)
      : null);

  function chooseSource(source: ExpenseSource) {
    const currentForm =
      process.env.EXPO_OS === 'ios'
        ? {
            ...form,
            amount: nativeAmount.get(),
            notes: nativeNotes.get(),
            title: nativeTitle.get(),
          }
        : form;
    const nextForm = applyExpenseSource(currentForm, source);
    setForm(nextForm);
    if (process.env.EXPO_OS === 'ios') {
      nativeTitle.set(nextForm.title);
      nativeAmount.set(nextForm.amount);
    }
  }

  async function save() {
    setMessage(null);
    try {
      await saveMutation.mutateAsync(undefined);
      router.back();
    } catch (error) {
      setMessage(messageFromError(error));
    }
  }

  function deleteExpenseAndClose() {
    void deleteMutation
      .mutateAsync(undefined)
      .then(() => router.back())
      .catch(error => setMessage(messageFromError(error, 'Could not delete this expense.')));
  }

  if (process.env.EXPO_OS === 'ios') {
    return (
      <>
        <Host colorScheme={theme} seedColor={colors.accent} style={{ flex: 1 }}>
          <Form modifiers={[scrollDismissesKeyboard('interactively')]}>
            {!isOnline ? (
              <Section title="Connection">
                <Label title="You’re offline" systemImage="wifi.slash" />
                <SwiftText>Reconnect to save changes to this expense.</SwiftText>
              </Section>
            ) : null}

            <Section
              footer={
                <SwiftText>
                  Give this cost a clear name and category so it stays easy to find later.
                </SwiftText>
              }
              title="Expense details"
            >
              <TextField
                autoFocus={!expense}
                onTextChange={title => setForm(current => ({ ...current, title }))}
                placeholder="What did you pay for?"
                text={nativeTitle}
                modifiers={[
                  accessibilityLabel('Expense title'),
                  textInputAutocapitalization('sentences'),
                  disabled(isFormDisabled),
                ]}
              />
              <Picker
                label="Category"
                onSelectionChange={category => setForm(current => ({ ...current, category }))}
                selection={form.category}
                systemImage="tag"
                modifiers={[pickerStyle('navigationLink'), disabled(isFormDisabled)]}
              >
                {categories.map(category => (
                  <SwiftText key={category.value} modifiers={[tag(category.value)]}>
                    {category.label}
                  </SwiftText>
                ))}
              </Picker>
            </Section>

            <Section title="Amount">
              <TextField
                onTextChange={amount => setForm(current => ({ ...current, amount }))}
                placeholder="0.00"
                text={nativeAmount}
                modifiers={[
                  accessibilityLabel('Expense amount'),
                  keyboardType('decimal-pad'),
                  disabled(isFormDisabled),
                ]}
              />
            </Section>

            <Section title="Currency">
              <Picker
                label="Currency"
                onSelectionChange={currency => setForm(current => ({ ...current, currency }))}
                selection={form.currency}
                systemImage="banknote"
                modifiers={[pickerStyle('menu'), disabled(isFormDisabled)]}
              >
                {currencyOptions.map(currency => (
                  <SwiftText key={currency.value} modifiers={[tag(currency.value)]}>
                    {currency.label}
                  </SwiftText>
                ))}
              </Picker>
            </Section>

            <Section title="Date">
              <DatePicker
                displayedComponents={['date']}
                onDateChange={expenseDate =>
                  setForm(current => ({
                    ...current,
                    expenseDate: dateTimeFieldValue(expenseDate, 'date'),
                  }))
                }
                selection={dateTimePickerDate(form.expenseDate, 'date')}
                title="Expense date"
                modifiers={[datePickerStyle('compact'), disabled(isFormDisabled)]}
              />
            </Section>

            <Section
              footer={
                <SwiftText>
                  Select an itinerary item to prefill its date, category, and known cost.
                </SwiftText>
              }
              title="Link to itinerary"
            >
              <Picker
                label="Link expense to"
                onSelectionChange={sourceKind =>
                  setForm(current => ({ ...current, sourceKind, sourceId: '' }))
                }
                selection={form.sourceKind}
                modifiers={[pickerStyle('navigationLink'), disabled(isFormDisabled)]}
              >
                <SwiftText modifiers={[tag('none')]}>Nothing</SwiftText>
                <SwiftText modifiers={[tag('stay')]}>Stay</SwiftText>
                <SwiftText modifiers={[tag('flight')]}>Flight</SwiftText>
                <SwiftText modifiers={[tag('schedule')]}>Itinerary item</SwiftText>
              </Picker>
              {form.sourceKind !== 'none' ? (
                sourceOptions.length ? (
                  <Picker
                    label="Itinerary item"
                    onSelectionChange={sourceId => {
                      const source = sourceOptions.find(option => option.id === sourceId);
                      if (source) chooseSource(source);
                    }}
                    selection={form.sourceId || null}
                    modifiers={[pickerStyle('navigationLink'), disabled(isFormDisabled)]}
                  >
                    {sourceOptions.map(option => (
                      <SwiftText key={option.id} modifiers={[tag(option.id)]}>
                        {option.title}
                      </SwiftText>
                    ))}
                  </Picker>
                ) : (
                  <SwiftText modifiers={[foregroundStyle('secondary')]}>
                    No {form.sourceKind === 'schedule' ? 'itinerary items' : `${form.sourceKind}s`}{' '}
                    are available for this trip.
                  </SwiftText>
                )
              ) : null}
            </Section>

            <Section title="Notes">
              <TextField
                axis="vertical"
                onTextChange={notes => setForm(current => ({ ...current, notes }))}
                placeholder="Optional details"
                text={nativeNotes}
                modifiers={[
                  lineLimit(3),
                  accessibilityLabel('Expense notes'),
                  textInputAutocapitalization('sentences'),
                  disabled(isFormDisabled),
                ]}
              />
            </Section>

            {expense && isManagedExpense ? (
              <Section title="Managed expense">
                <Label title="Managed with itinerary" systemImage="link" />
                <SwiftText>
                  This expense is managed with its linked stay or flight. Edit or remove that
                  itinerary item to update it.
                </SwiftText>
              </Section>
            ) : null}

            {formError ? (
              <Section title="Couldn’t save expense">
                <SwiftText modifiers={[foregroundStyle(colors.danger)]}>{formError}</SwiftText>
              </Section>
            ) : null}

            {expense && !isManagedExpense ? (
              <Section title="Danger zone">
                <ConfirmationDialog
                  isPresented={isDeleteConfirmationPresented}
                  onIsPresentedChange={setIsDeleteConfirmationPresented}
                  title="Delete this expense?"
                  titleVisibility="visible"
                >
                  <ConfirmationDialog.Trigger>
                    <SwiftButton
                      label="Delete expense"
                      role="destructive"
                      systemImage="trash"
                      onPress={() => setIsDeleteConfirmationPresented(true)}
                      modifiers={[disabled(!isOnline || deleteMutation.isPending)]}
                    />
                  </ConfirmationDialog.Trigger>
                  <ConfirmationDialog.Actions>
                    <SwiftButton
                      label="Delete expense"
                      role="destructive"
                      onPress={deleteExpenseAndClose}
                    />
                    <SwiftButton label="Cancel" role="cancel" />
                  </ConfirmationDialog.Actions>
                  <ConfirmationDialog.Message>
                    <SwiftText>This cannot be undone.</SwiftText>
                  </ConfirmationDialog.Message>
                </ConfirmationDialog>
              </Section>
            ) : null}
          </Form>
        </Host>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={expense ? 'Save expense changes' : 'Add expense'}
            disabled={isFormDisabled}
            onPress={() => void save()}
            tintColor={colors.accent}
            variant="done"
          >
            {saveMutation.isPending ? 'Saving…' : expense ? 'Save' : 'Add'}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </>
    );
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
        <View style={{ gap: 7 }}>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
            Currency
          </Text>
          <ChipGroup
            disabled={isFormDisabled}
            options={[...currencyOptions]}
            value={form.currency}
            onChange={currency => setForm(current => ({ ...current, currency }))}
          />
        </View>
        <DateTimeField
          label="Date"
          mode="date"
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
          tintColor={colors.accent}
          variant="done"
        >
          {expense ? 'Save' : 'Add'}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
