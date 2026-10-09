import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  formatMoney,
  moneyMinorUnits,
  paymentStatusLabels,
  splitMoneyEqually,
  validateAllocation,
  type ExpenseItem,
  type ExpenseCategory,
  type PaymentStatus,
  type TripEditorTrip,
} from '@wayfare/domain';
import { createExpense, deleteExpense, updateExpense } from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Field } from '@/components/ui/field';
import { CurrencyPicker } from '@/components/ui/currency-picker';
import { ChipGroup } from '@/components/ui/controls';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { expenseCategoryLabels } from './expense-insights';
import { messageFromError } from '@/lib/format';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

function confirm(title: string, message: string) {
  return new Promise<boolean>(resolve =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Save changes', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    ),
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function ExpenseEditorScreen() {
  const params = useLocalSearchParams<{
    expenseId?: string | string[];
    sourceId?: string | string[];
    sourceKind?: string | string[];
  }>();
  const query = useTripEditor();
  if (query.isLoading) return <LoadingState label="Loading payment…" />;
  if (query.error)
    return (
      <ErrorState message={messageFromError(query.error)} onRetry={() => void query.refetch()} />
    );
  if (!query.data)
    return (
      <EmptyState
        title="No trip selected"
        detail="Choose a trip before adding or editing a payment."
      />
    );
  const expenseId = first(params.expenseId);
  return (
    <ExpenseEditor
      key={expenseId ?? 'new'}
      trip={query.data}
      expenseId={expenseId}
      sourceId={first(params.sourceId)}
      sourceKind={first(params.sourceKind)}
    />
  );
}
function ExpenseEditor({
  trip,
  expenseId,
  sourceId,
  sourceKind,
}: {
  trip: TripEditorTrip;
  expenseId?: string;
  sourceId?: string;
  sourceKind?: string;
}) {
  const { colors } = useTheme();
  const expense = trip.expenses.find(item => item.id === expenseId);
  const sources: ExpenseItem[] = [
    ...trip.flights.map(item => ({
      kind: 'FLIGHT' as const,
      itemId: item.id,
      title: item.flightNumber,
      date: item.departureDate,
      category: 'FLIGHT',
    })),
    ...trip.stays.map(item => ({
      kind: 'HOTEL' as const,
      itemId: item.id,
      title: item.name,
      date: item.checkInDate,
      category: 'HOTEL',
    })),
    ...trip.schedule.map(item => ({
      kind: 'ACTIVITY' as const,
      itemId: item.id,
      title:
        item.title ?? trip.places.find(place => place.id === item.savedPlaceId)?.name ?? 'Activity',
      date: item.date,
      category: 'OTHER',
    })),
  ];
  const initialSource = sources.find(
    item =>
      item.itemId === sourceId &&
      item.kind === { flight: 'FLIGHT', stay: 'HOTEL', schedule: 'ACTIVITY' }[sourceKind ?? ''],
  );
  const [title, setTitle] = useState(expense?.title ?? initialSource?.title ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [currency, setCurrency] = useState(expense?.currency ?? trip.defaultCurrency);
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'OTHER');
  const [date, setDate] = useState(expense?.expenseDate ?? trip.startDate);
  const [status, setStatus] = useState<PaymentStatus>(
    expense?.paymentStatus ?? (expense ? 'NEEDS_REVIEW' : 'UNPAID'),
  );
  const [paymentDate, setPaymentDate] = useState(expense?.paymentDate ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [coverage, setCoverage] = useState<ExpenseItem[]>(
    expense?.coverage ??
      (initialSource
        ? [initialSource]
        : sources.filter(
            item =>
              item.itemId === expense?.flightId ||
              item.itemId === expense?.stayId ||
              item.itemId === expense?.scheduleItemId,
          )),
  );
  const [query, setQuery] = useState('');
  const { isOnline, mutation } = useTripMutation(trip.id, async () => {
    if (!trip.access.canEdit) throw new Error('Editing permission required.');
    moneyMinorUnits(amount, currency);
    validateAllocation(amount, currency, coverage);
    const confirmPaid = expense?.paymentStatus === 'PAID' && status === 'PAID';
    if (
      confirmPaid &&
      !(await confirm(
        'Keep payment paid?',
        `Confirm ${title}, ${formatMoney(amount, currency)}, remains paid after these changes.`,
      ))
    )
      return false;
    const moveFrom: Record<string, number> = {};
    for (const item of coverage) {
      const previous = trip.expenses.find(
        row =>
          row.id !== expense?.id &&
          row.coverage?.some(
            link => link.itemId && link.itemId === item.itemId && link.kind === item.kind,
          ),
      );
      if (previous) {
        if (
          !(await confirm(
            'Move to this expense?',
            `${item.title} is covered by ${previous.title}, ${formatMoney(previous.amount, previous.currency)}. Its amount, notes and receipts will be preserved.`,
          ))
        )
          return false;
        moveFrom[previous.id] = previous.version!;
      }
    }
    const payload = {
      title,
      amount: Number(amount),
      currency,
      category,
      expenseDate: date,
      paymentStatus: status,
      paymentDate: paymentDate || null,
      notes,
      coverage: coverage.filter(item => item.itemId),
      expectedVersion: expense?.version,
      confirmPaid,
      moveFrom,
    };
    if (expense) await updateExpense(trip.id, expense.id, payload);
    else await createExpense(trip.id, payload);
    return true;
  });
  const { mutation: remove } = useTripMutation(trip.id, () => deleteExpense(trip.id, expense!.id));
  const disabled = !isOnline || mutation.isPending || !trip.access.canEdit;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.md, paddingBottom: 36, gap: space.md }}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen options={{ title: expense ? 'Payment details' : 'Add expense' }} />
      {!isOnline && <OfflineNotice visible />}
      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
          Expense details
        </Text>
        <Field label="Title" value={title} onChangeText={setTitle} editable={!disabled} />
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          editable={!disabled}
        />
        <CurrencyPicker
          value={currency}
          onChange={setCurrency}
          preferred={[trip.defaultCurrency, ...trip.expenses.map(item => item.currency)]}
          disabled={disabled}
        />
        <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
          Category
        </Text>
        <ChipGroup
          options={Object.entries(expenseCategoryLabels).map(([value, label]) => ({
            value: value as ExpenseCategory,
            label,
          }))}
          value={category}
          onChange={setCategory}
          disabled={disabled}
        />
        <DateTimeField
          label="Expense date"
          mode="date"
          value={date}
          onChangeText={setDate}
          disabled={disabled}
        />
      </Card>

      <Card>
        <View style={{ gap: space.xs }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Payment status
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
            {paymentStatusLabels[status]}
          </Text>
        </View>
        <ChipGroup
          options={[
            { value: 'UNPAID', label: 'Unpaid' },
            { value: 'PAID', label: 'Paid' },
          ]}
          value={status}
          onChange={setStatus}
          disabled={disabled}
        />
        {status === 'PAID' ? (
          <DateTimeField
            label="Payment date"
            mode="date"
            value={paymentDate || date}
            onChangeText={setPaymentDate}
            disabled={disabled}
          />
        ) : null}
      </Card>

      <Card>
        <View style={{ gap: space.xs }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Covered reservations
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
            Select one or more items. This payment is counted once in trip totals.
          </Text>
        </View>
        <Field label="Search reservations" value={query} onChangeText={setQuery} />
        {(['FLIGHT', 'HOTEL', 'ACTIVITY'] as const).map(kind => {
          const options = sources.filter(
            item =>
              item.kind === kind &&
              `${item.title} ${item.date}`.toLowerCase().includes(query.toLowerCase()),
          );
          if (!options.length) return null;
          return (
            <View key={kind} style={{ gap: space.sm }}>
              <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                {kind === 'FLIGHT' ? 'Flights' : kind === 'HOTEL' ? 'Hotels' : 'Activities'}
              </Text>
              {options.map(item => {
                const selected = coverage.some(link => link.itemId === item.itemId);
                return (
                  <Button
                    accessibilityState={{ selected }}
                    key={item.itemId}
                    disabled={disabled}
                    tone={selected ? 'primary' : 'secondary'}
                    onPress={() =>
                      setCoverage(current =>
                        selected
                          ? current.filter(link => link.itemId !== item.itemId)
                          : [...current, item],
                      )
                    }
                  >
                    {selected ? '✓ ' : ''}
                    {item.title} · {item.date}
                  </Button>
                );
              })}
            </View>
          );
        })}
        {coverage.length ? (
          <View style={{ gap: space.sm }}>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Optional allocation
            </Text>
            {coverage.map((item, index) => (
              <Field
                key={`${item.itemId}:${index}`}
                label={`${item.title} share`}
                value={item.allocatedAmount ?? ''}
                keyboardType="decimal-pad"
                editable={!disabled}
                onChangeText={value =>
                  setCoverage(current =>
                    current.map((link, position) =>
                      index === position ? { ...link, allocatedAmount: value || null } : link,
                    ),
                  )
                }
              />
            ))}
            <Button
              tone="secondary"
              disabled={disabled}
              onPress={() => {
                try {
                  const shares = splitMoneyEqually(amount, currency, coverage.length);
                  setCoverage(current =>
                    current.map((item, index) => ({ ...item, allocatedAmount: shares[index] })),
                  );
                } catch (error) {
                  Alert.alert('Check amount', (error as Error).message);
                }
              }}
            >
              Split equally
            </Button>
          </View>
        ) : null}
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
          Notes and documents
        </Text>
        <Field label="Notes" value={notes} onChangeText={setNotes} editable={!disabled} multiline />
        {expense ? (
          <Button
            tone="secondary"
            onPress={() =>
              router.push({
                pathname: '/item-details',
                params: { kind: 'EXPENSE', itemId: expense.id },
              })
            }
          >
            Tickets &amp; links
          </Button>
        ) : (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
            Save the expense before adding receipts or links.
          </Text>
        )}
      </Card>
      {(mutation.error || remove.error) && (
        <Text accessibilityRole="alert" selectable style={{ color: colors.danger }}>
          {messageFromError(mutation.error ?? remove.error)}
        </Text>
      )}
      <Button
        disabled={disabled}
        loading={mutation.isPending}
        onPress={() =>
          mutation.mutate(undefined, {
            onSuccess: saved => {
              if (saved) router.back();
            },
          })
        }
      >
        {expense ? 'Save changes' : 'Add expense'}
      </Button>
      {expense && (
        <Button
          disabled={disabled}
          loading={remove.isPending}
          tone="danger"
          onPress={() =>
            Alert.alert(
              'Delete expense?',
              'Itinerary items remain; payment indicators will be removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete expense',
                  style: 'destructive',
                  onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }),
                },
              ],
            )
          }
        >
          Delete expense
        </Button>
      )}
    </ScrollView>
  );
}
