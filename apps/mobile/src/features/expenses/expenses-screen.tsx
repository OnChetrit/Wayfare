import AddIcon from '@expo/material-symbols/add.xml';
import { Link, router, Stack } from 'expo-router';
import * as React from 'react';
import { RefreshControl, Text, View } from 'react-native';

import { expenseCategories, type ExpenseCategory } from '@wayfare/domain';
import { useIsOnline } from '@/api/query-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/controls';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/features/auth/auth-context';
import {
  activityExpenseTotals,
  categoryBreakdown,
  categoryExpenseTotals,
  expenseCategoryLabels,
  expenseSourcesForTrip,
  groupedExpenseTotals,
  missingExpenseSources,
  perDayExpenseTotals,
  visibleExpenses,
  type ExpenseSource,
} from '@/features/expenses/expense-insights';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { formatDate, formatMoney, messageFromError } from '@/lib/format';
import { preferredCurrency } from '@/lib/user-preferences';
import { colors } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

const categoryColors: Record<ExpenseCategory, string> = {
  FLIGHT: '#8CB7FF',
  HOTEL: '#C99BEA',
  RESTAURANT: '#E7B96F',
  TICKETS: '#A9E6C0',
  SHOPPING: '#FFB4C4',
  TRANSPORT: '#75D5D1',
  OTHER: '#ABC0B4',
};

function formatTotals(totals: { amount: number; currency: string }[]) {
  return totals.length
    ? totals.map(total => formatMoney(total.amount, total.currency)).join(' · ')
    : '—';
}

function sourceLabel(source: ExpenseSource) {
  const kind = source.kind === 'stay' ? 'Hotel' : source.kind === 'flight' ? 'Flight' : 'Activity';
  return `${kind} · ${source.title}`;
}

function tripDayCount(startDate: string, endDate: string) {
  return Math.max(
    1,
    Math.round(
      (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000,
    ) + 1,
  );
}

export function ExpensesScreen() {
  useTheme();
  const tripQuery = useTripEditor();
  const isOnline = useIsOnline();
  const { session } = useAuth();
  const [filter, setFilter] = React.useState<ExpenseCategory | 'ALL'>('ALL');

  if (tripQuery.isLoading) return <LoadingState label="Loading expenses…" />;
  if (tripQuery.error) {
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }
  const trip = tripQuery.data;
  if (!trip) {
    return (
      <Screen>
        <EmptyState
          title="No trip selected"
          detail="Choose a trip to track its expenses."
          action={<Button onPress={() => router.push('/trip-form')}>Create trip</Button>}
        />
      </Screen>
    );
  }

  const totals = groupedExpenseTotals(trip.expenses);
  const totalCurrency = preferredCurrency(session?.user.user_metadata, trip.defaultCurrency);
  const breakdownCurrency = totals.some(total => total.currency === totalCurrency)
    ? totalCurrency
    : (totals[0]?.currency ?? totalCurrency);
  const breakdown = categoryBreakdown(trip.expenses, breakdownCurrency);
  const dailyTotals = perDayExpenseTotals(trip.expenses);
  const sources = expenseSourcesForTrip(trip);
  const missingSources = missingExpenseSources(trip.expenses, sources);
  const expenses = visibleExpenses(trip.expenses, filter);
  const days = tripDayCount(trip.startDate, trip.endDate);
  const categoryFilters = [
    { label: 'All', value: 'ALL' as const },
    ...expenseCategories.map(category => ({
      label: expenseCategoryLabels[category],
      value: category,
    })),
  ];

  return (
    <>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={tripQuery.isRefetching}
            onRefresh={() => void tripQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <OfflineNotice visible={!isOnline} />
        <View style={{ gap: 3 }}>
          <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
            Expense insights
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {trip.name} · {trip.expenses.length} recorded{' '}
            {trip.expenses.length === 1 ? 'expense' : 'expenses'}
          </Text>
        </View>

        <Card style={{ gap: 12 }}>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
            TOTAL TRIP COST
          </Text>
          {totals.length ? (
            <View style={{ gap: 8 }}>
              {totals.map(total => (
                <View key={total.currency} style={{ gap: 2 }}>
                  <Text
                    selectable
                    style={{
                      color: colors.accent,
                      fontSize: 28,
                      fontVariant: ['tabular-nums'],
                      fontWeight: '800',
                    }}
                  >
                    {formatMoney(total.amount, total.currency)}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                    {formatMoney(total.amount / days, total.currency)} per day
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text selectable style={{ color: colors.textMuted }}>
              Add an expense to see trip totals.
            </Text>
          )}
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            {days} {days === 1 ? 'day' : 'days'} · Totals stay separate by currency.
          </Text>
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Flights', totals: categoryExpenseTotals(trip.expenses, 'FLIGHT') },
            { label: 'Hotels', totals: categoryExpenseTotals(trip.expenses, 'HOTEL') },
            { label: 'Activities', totals: activityExpenseTotals(trip.expenses) },
          ].map(summary => (
            <Card key={summary.label} style={{ flex: 1, gap: 5, minWidth: 150 }}>
              <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                {summary.label.toUpperCase()}
              </Text>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                {formatTotals(summary.totals)}
              </Text>
            </Card>
          ))}
        </View>

        {dailyTotals.length ? (
          <Card style={{ gap: 10 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
              Per-day spend
            </Text>
            {dailyTotals.map(day => (
              <View key={day.date} style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
                <Text selectable style={{ color: colors.textMuted, flex: 1 }}>
                  {formatDate(day.date, { weekday: 'short' })}
                </Text>
                <Text
                  selectable
                  style={{ color: colors.text, fontVariant: ['tabular-nums'], fontWeight: '700' }}
                >
                  {formatTotals(day.totals)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {breakdown.length ? (
          <Card style={{ gap: 12 }}>
            <View style={{ gap: 2 }}>
              <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
                Where it goes
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                {breakdownCurrency} spending by category
              </Text>
            </View>
            {breakdown.map(item => (
              <View key={item.category} style={{ gap: 5 }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
                  <Text selectable style={{ color: colors.textMuted, flex: 1, fontSize: 13 }}>
                    {expenseCategoryLabels[item.category]}
                  </Text>
                  <Text
                    selectable
                    style={{ color: colors.text, fontSize: 13, fontVariant: ['tabular-nums'] }}
                  >
                    {formatMoney(item.amount, breakdownCurrency)}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderCurve: 'continuous',
                    borderRadius: 999,
                    height: 7,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      backgroundColor: categoryColors[item.category],
                      borderCurve: 'continuous',
                      borderRadius: 999,
                      height: '100%',
                      width: `${Math.max(3, item.percentage)}%`,
                    }}
                  />
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {missingSources.length ? (
          <Card style={{ borderColor: colors.accent, gap: 10 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
              Unrecorded itinerary costs
            </Text>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
              {missingSources.length} {missingSources.length === 1 ? 'item has' : 'items have'} no
              linked expense yet. Create one with the itinerary source already selected.
            </Text>
            {missingSources.map(source => (
              <View key={`${source.kind}:${source.id}`} style={{ gap: 5 }}>
                <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
                  {sourceLabel(source)}
                </Text>
                <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                  {formatDate(source.date)}
                  {source.amount != null && source.currency
                    ? ` · ${formatMoney(source.amount, source.currency)}`
                    : ''}
                </Text>
                <Link
                  href={{
                    pathname: '/expense-editor',
                    params: { sourceKind: source.kind, sourceId: source.id },
                  }}
                  asChild
                >
                  <Button disabled={!isOnline} tone="secondary">
                    Add linked expense
                  </Button>
                </Link>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>
            Expenses
          </Text>
          <ChipGroup options={categoryFilters} value={filter} onChange={setFilter} />
        </View>
        {expenses.length ? (
          expenses.map(expense => (
            <Link
              key={expense.id}
              href={{ pathname: '/expense-editor', params: { expenseId: expense.id } }}
              asChild
            >
              <Card>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      selectable
                      style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
                    >
                      {expense.title}
                    </Text>
                    <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                      {expenseCategoryLabels[expense.category]} · {formatDate(expense.expenseDate)}
                      {expense.notes ? ` · ${expense.notes}` : ''}
                    </Text>
                  </View>
                  <Text
                    selectable
                    style={{
                      color: colors.accent,
                      fontVariant: ['tabular-nums'],
                      fontWeight: '800',
                    }}
                  >
                    {formatMoney(expense.amount, expense.currency)}
                  </Text>
                </View>
              </Card>
            </Link>
          ))
        ) : (
          <EmptyState
            title={filter === 'ALL' ? 'No expenses yet' : `No ${expenseCategoryLabels[filter]} yet`}
            detail={
              filter === 'ALL'
                ? 'Add a booking, ticket, meal, or anything else you want to track.'
                : 'Choose another category or add the first expense in this one.'
            }
            action={
              <Link href="/expense-editor" asChild>
                <Button>Add expense</Button>
              </Link>
            }
          />
        )}
      </Screen>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Add expense"
          icon={process.env.EXPO_OS === 'ios' ? 'plus' : AddIcon}
          onPress={() => router.push('/expense-editor')}
        />
      </Stack.Toolbar>
    </>
  );
}
