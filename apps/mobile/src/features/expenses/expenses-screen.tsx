import AddIcon from '@expo/material-symbols/add.xml';
import {
  Button as SwiftButton,
  Host,
  HStack,
  List,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from '@expo/ui/swift-ui';
import { buttonStyle, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Link, router, Stack } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { Screen } from '@/components/ui/screen';
import { useIsOnline } from '@/api/query-client';
import { useAuth } from '@/features/auth/auth-context';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { formatMoney, messageFromError } from '@/lib/format';
import { preferredCurrency } from '@/lib/user-preferences';
import { colors } from '@/theme/tokens';

export function ExpensesScreen() {
  const tripQuery = useTripEditor();
  const isOnline = useIsOnline();
  const { session } = useAuth();
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
  const totalCurrency = preferredCurrency(session?.user.user_metadata, trip.defaultCurrency);
  const total = trip.expenses
    .filter(expense => expense.currency === totalCurrency)
    .reduce((sum, expense) => sum + expense.amount, 0);
  if (process.env.EXPO_OS === 'ios') {
    return (
      <>
        <Host colorScheme="dark" seedColor={colors.accent} style={{ flex: 1 }}>
          <List
            modifiers={[
              listStyle('plain'),
              refreshable(async () => {
                await tripQuery.refetch();
              }),
            ]}
          >
            {!isOnline ? (
              <Section title="Connection">
                <SwiftText>You’re offline. Reconnect to add or edit expenses.</SwiftText>
              </Section>
            ) : null}
            <Section title={`Total in ${totalCurrency}`}>
              <SwiftText>{formatMoney(total, totalCurrency)}</SwiftText>
            </Section>
            <Section title="Expenses">
              {trip.expenses.length ? (
                trip.expenses.map(expense => (
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
                    <VStack alignment="leading" spacing={3}>
                      <HStack spacing={12}>
                        <VStack alignment="leading" spacing={3}>
                          <SwiftText>{expense.title}</SwiftText>
                          <SwiftText>
                            {expense.category} · {expense.expenseDate}
                          </SwiftText>
                        </VStack>
                        <Spacer />
                        <SwiftText>{formatMoney(expense.amount, expense.currency)}</SwiftText>
                      </HStack>
                    </VStack>
                  </SwiftButton>
                ))
              ) : (
                <VStack alignment="leading" spacing={8}>
                  <SwiftText>No expenses yet</SwiftText>
                  <SwiftText>
                    Add a booking, ticket, meal, or anything else you want to track.
                  </SwiftText>
                  <SwiftButton label="Add expense" onPress={() => router.push('/expense-editor')} />
                </VStack>
              )}
            </Section>
          </List>
        </Host>
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
            Expenses
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {trip.name}
          </Text>
        </View>
        <Card>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
            TOTAL IN {totalCurrency}
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
            {formatMoney(total, totalCurrency)}
          </Text>
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
                    <Text
                      selectable
                      style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
                    >
                      {expense.title}
                    </Text>
                    <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                      {expense.category} · {expense.expenseDate}
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
