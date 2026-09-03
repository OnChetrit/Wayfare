import AddIcon from '@expo/material-symbols/add.xml';
import {
  Button as SwiftButton,
  Host,
  HStack,
  List,
  Menu,
  ProgressView,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  listStyle,
  monospacedDigit,
  refreshable,
  tint,
} from '@expo/ui/swift-ui/modifiers';
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
import { formatDate, formatDateRange, formatMoney, messageFromError } from '@/lib/format';
import { preferredCurrency } from '@/lib/user-preferences';
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
  const { colors, theme } = useTheme();
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

  if (process.env.EXPO_OS === 'ios') {
    const selectedFilterLabel = filter === 'ALL' ? 'All categories' : expenseCategoryLabels[filter];

    return (
      <>
        <Host colorScheme={theme} seedColor={colors.accent} style={{ flex: 1 }}>
          <List
            modifiers={[
              listStyle('insetGrouped'),
              refreshable(async () => {
                await tripQuery.refetch();
              }),
            ]}
          >
            {!isOnline ? (
              <Section title="Connection">
                <SwiftText>You’re offline. Reconnect to update your expenses.</SwiftText>
              </Section>
            ) : null}

            <Section
              footer={
                <SwiftText>
                  {days} {days === 1 ? 'day' : 'days'} · Totals remain separate by currency.
                </SwiftText>
              }
              title={trip.name}
            >
              <SwiftText
                modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}
              >
                {formatDateRange(trip.startDate, trip.endDate)} · {trip.expenses.length} recorded{' '}
                {trip.expenses.length === 1 ? 'expense' : 'expenses'}
              </SwiftText>
              {totals.length ? (
                totals.map(total => (
                  <HStack key={total.currency} alignment="firstTextBaseline">
                    <VStack alignment="leading" spacing={2}>
                      <SwiftText
                        modifiers={[
                          font({ textStyle: 'title2', weight: 'bold' }),
                          monospacedDigit(),
                        ]}
                      >
                        {formatMoney(total.amount, total.currency)}
                      </SwiftText>
                      <SwiftText
                        modifiers={[
                          font({ textStyle: 'subheadline' }),
                          foregroundStyle('secondary'),
                          monospacedDigit(),
                        ]}
                      >
                        {formatMoney(total.amount / days, total.currency)} per day
                      </SwiftText>
                    </VStack>
                    <Spacer />
                    <SwiftText modifiers={[foregroundStyle('secondary')]}>
                      {total.currency}
                    </SwiftText>
                  </HStack>
                ))
              ) : (
                <VStack alignment="leading" spacing={3}>
                  <SwiftText modifiers={[font({ textStyle: 'headline' })]}>
                    No expenses yet
                  </SwiftText>
                  <SwiftText modifiers={[foregroundStyle('secondary')]}>
                    Add an expense to see your trip total.
                  </SwiftText>
                </VStack>
              )}
            </Section>

            <Section title="At a glance">
              {[
                {
                  label: 'Flights',
                  totals: categoryExpenseTotals(trip.expenses, 'FLIGHT'),
                },
                {
                  label: 'Stays',
                  totals: categoryExpenseTotals(trip.expenses, 'HOTEL'),
                },
                {
                  label: 'Activities',
                  totals: activityExpenseTotals(trip.expenses),
                },
              ].map(summary => (
                <HStack key={summary.label} alignment="firstTextBaseline">
                  <SwiftText>{summary.label}</SwiftText>
                  <Spacer />
                  <SwiftText modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
                    {formatTotals(summary.totals)}
                  </SwiftText>
                </HStack>
              ))}
            </Section>

            {dailyTotals.length ? (
              <Section title="Daily spend">
                {dailyTotals.map(day => (
                  <HStack key={day.date} alignment="firstTextBaseline">
                    <VStack alignment="leading" spacing={2}>
                      <SwiftText>{formatDate(day.date, { weekday: 'long' })}</SwiftText>
                      <SwiftText
                        modifiers={[
                          font({ textStyle: 'subheadline' }),
                          foregroundStyle('secondary'),
                        ]}
                      >
                        {formatDate(day.date)}
                      </SwiftText>
                    </VStack>
                    <Spacer />
                    <SwiftText modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
                      {formatTotals(day.totals)}
                    </SwiftText>
                  </HStack>
                ))}
              </Section>
            ) : null}

            {breakdown.length ? (
              <Section
                footer={<SwiftText>{breakdownCurrency} spending by category.</SwiftText>}
                title="Where it goes"
              >
                {breakdown.map(item => (
                  <VStack key={item.category} alignment="leading" spacing={6}>
                    <HStack alignment="firstTextBaseline" spacing={8}>
                      <SwiftText modifiers={[foregroundStyle(categoryColors[item.category])]}>
                        ●
                      </SwiftText>
                      <SwiftText>{expenseCategoryLabels[item.category]}</SwiftText>
                      <Spacer />
                      <VStack alignment="trailing" spacing={1}>
                        <SwiftText modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
                          {formatMoney(item.amount, breakdownCurrency)}
                        </SwiftText>
                        <SwiftText
                          modifiers={[
                            font({ textStyle: 'caption' }),
                            foregroundStyle('secondary'),
                            monospacedDigit(),
                          ]}
                        >
                          {Math.round(item.percentage)}%
                        </SwiftText>
                      </VStack>
                    </HStack>
                    <ProgressView
                      value={item.percentage / 100}
                      modifiers={[tint(categoryColors[item.category])]}
                    />
                  </VStack>
                ))}
              </Section>
            ) : null}

            {missingSources.length ? (
              <Section
                footer={
                  <SwiftText>
                    These itinerary items have no linked expense. Tap one to add it with the source
                    selected.
                  </SwiftText>
                }
                title="Costs to add"
              >
                {missingSources.map(source => (
                  <SwiftButton
                    key={`${source.kind}:${source.id}`}
                    modifiers={[buttonStyle('plain'), disabled(!isOnline)]}
                    onPress={() =>
                      router.push({
                        pathname: '/expense-editor',
                        params: { sourceKind: source.kind, sourceId: source.id },
                      })
                    }
                  >
                    <HStack alignment="firstTextBaseline">
                      <VStack alignment="leading" spacing={3}>
                        <SwiftText>{sourceLabel(source)}</SwiftText>
                        <SwiftText
                          modifiers={[
                            font({ textStyle: 'subheadline' }),
                            foregroundStyle('secondary'),
                          ]}
                        >
                          {formatDate(source.date)}
                          {source.amount != null && source.currency
                            ? ` · ${formatMoney(source.amount, source.currency)}`
                            : ''}
                        </SwiftText>
                      </VStack>
                      <Spacer />
                      <SwiftText modifiers={[foregroundStyle('secondary')]}>Add</SwiftText>
                    </HStack>
                  </SwiftButton>
                ))}
              </Section>
            ) : null}

            <Section
              footer={
                expenses.length ? undefined : (
                  <SwiftText>
                    {filter === 'ALL'
                      ? 'Add a booking, ticket, meal, or anything else you want to track.'
                      : 'Choose another category or add the first expense in this one.'}
                  </SwiftText>
                )
              }
              title="Expenses"
            >
              <Menu
                label={selectedFilterLabel}
                modifiers={[tint(colors.accent)]}
                systemImage="line.3.horizontal.decrease.circle"
              >
                {categoryFilters.map(option => (
                  <SwiftButton
                    key={option.value}
                    label={option.label}
                    onPress={() => setFilter(option.value)}
                    systemImage={option.value === filter ? 'checkmark' : undefined}
                  />
                ))}
              </Menu>
              {expenses.length ? (
                expenses.map(expense => (
                  <SwiftButton
                    key={expense.id}
                    modifiers={[buttonStyle('plain')]}
                    onPress={() =>
                      router.push({
                        pathname: '/expense-editor',
                        params: { expenseId: expense.id },
                      })
                    }
                  >
                    <HStack alignment="firstTextBaseline">
                      <VStack alignment="leading" spacing={3}>
                        <SwiftText>{expense.title}</SwiftText>
                        <SwiftText
                          modifiers={[
                            font({ textStyle: 'subheadline' }),
                            foregroundStyle('secondary'),
                          ]}
                        >
                          {expenseCategoryLabels[expense.category]} ·{' '}
                          {formatDate(expense.expenseDate)}
                          {expense.notes ? ` · ${expense.notes}` : ''}
                        </SwiftText>
                      </VStack>
                      <Spacer />
                      <VStack alignment="trailing" spacing={3}>
                        <SwiftText modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
                          {formatMoney(expense.amount, expense.currency)}
                        </SwiftText>
                        <SwiftText modifiers={[foregroundStyle('secondary')]}>›</SwiftText>
                      </VStack>
                    </HStack>
                  </SwiftButton>
                ))
              ) : (
                <SwiftButton
                  label="Add expense"
                  modifiers={[buttonStyle('borderedProminent'), disabled(!isOnline)]}
                  onPress={() => router.push('/expense-editor')}
                  systemImage="plus"
                />
              )}
            </Section>
          </List>
        </Host>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Add expense"
            disabled={!isOnline}
            icon="plus"
            onPress={() => router.push('/expense-editor')}
            tintColor={colors.accent}
          />
        </Stack.Toolbar>
      </>
    );
  }

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
          tintColor={colors.accent}
        />
      </Stack.Toolbar>
    </>
  );
}
