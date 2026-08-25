import { Link } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { Screen } from '@/components/ui/screen';
import { useIsOnline } from '@/api/query-client';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { formatMoney, messageFromError } from '@/lib/format';
import { colors } from '@/theme/tokens';

export function ExpensesScreen() {
  const tripQuery = useTripEditor();
  const isOnline = useIsOnline();
  if (tripQuery.isLoading) return <LoadingState label="Loading expenses…" />;
  if (tripQuery.error)
    return (
      <ErrorState
        message={messageFromError(tripQuery.error)}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  const trip = tripQuery.data;
  if (!trip)
    return (
      <Screen>
        <EmptyState title="No trip selected" detail="Choose a trip to track its expenses." />
      </Screen>
    );
  const total = trip.expenses
    .filter(expense => expense.currency === trip.defaultCurrency)
    .reduce((sum, expense) => sum + expense.amount, 0);
  return (
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
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ gap: 3 }}>
          <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
            Expenses
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {trip.name}
          </Text>
        </View>
        <Link href="/expense-editor" asChild>
          <Button accessibilityLabel="Add expense">Add</Button>
        </Link>
      </View>
      <Card>
        <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
          TOTAL IN {trip.defaultCurrency}
        </Text>
        <Text
          selectable
          style={{
            color: colors.accent,
            fontSize: 28,
            fontVariant: ['tabular-nums'],
            fontWeight: '800',
          }}
        >
          {formatMoney(total, trip.defaultCurrency)}
        </Text>
        {trip.expenses.some(expense => expense.currency !== trip.defaultCurrency) ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            Amounts in other currencies are shown separately below.
          </Text>
        ) : null}
      </Card>
      {trip.expenses.length ? (
        trip.expenses.map(expense => (
          <Link
            key={expense.id}
            href={{ pathname: '/expense-editor', params: { expenseId: expense.id } }}
            asChild
          >
            <Card>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                    {expense.title}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                    {expense.category} · {expense.expenseDate}
                  </Text>
                </View>
                <Text
                  selectable
                  style={{ color: colors.accent, fontVariant: ['tabular-nums'], fontWeight: '800' }}
                >
                  {formatMoney(expense.amount, expense.currency)}
                </Text>
              </View>
            </Card>
          </Link>
        ))
      ) : (
        <EmptyState
          title="No expenses yet"
          detail="Add a booking, ticket, meal, or anything else you want to track."
          action={
            <Link href="/expense-editor" asChild>
              <Button>Add expense</Button>
            </Link>
          }
        />
      )}
    </Screen>
  );
}
