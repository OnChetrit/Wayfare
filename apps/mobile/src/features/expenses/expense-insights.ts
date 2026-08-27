import {
  expenseCategories,
  type Expense,
  type ExpenseCategory,
  type ScheduleItem,
  type TripEditorTrip,
} from '@wayfare/domain';

export type ExpenseSourceKind = 'flight' | 'schedule' | 'stay';

export type ExpenseSource = {
  amount?: number;
  category: ExpenseCategory;
  currency?: string;
  date: string;
  id: string;
  kind: ExpenseSourceKind;
  title: string;
};

export type ExpenseEditorValues = {
  amount: string;
  category: ExpenseCategory;
  currency: string;
  expenseDate: string;
  notes: string;
  sourceId: string;
  sourceKind: ExpenseSourceKind | 'none';
  title: string;
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  FLIGHT: 'Flights',
  HOTEL: 'Hotels',
  RESTAURANT: 'Food',
  TICKETS: 'Tickets',
  SHOPPING: 'Shopping',
  TRANSPORT: 'Transport',
  OTHER: 'Other',
};

const activityCategories = new Set<ExpenseCategory>([
  'RESTAURANT',
  'TICKETS',
  'SHOPPING',
  'TRANSPORT',
  'OTHER',
]);

export function activityExpenseCategory(item: ScheduleItem): ExpenseCategory {
  if (item.category === 'RESTAURANT' || item.category === 'CAFE' || item.category === 'BAR') {
    return 'RESTAURANT';
  }
  if (item.category === 'SHOPPING') return 'SHOPPING';
  if (item.category === 'TRANSPORT') return 'TRANSPORT';
  if (item.category === 'ATTRACTION') return 'TICKETS';
  return 'OTHER';
}

export function expenseSourcesForTrip(
  trip: Pick<TripEditorTrip, 'flights' | 'places' | 'schedule' | 'stays'>,
): ExpenseSource[] {
  const staySources = trip.stays.map(stay => ({
    kind: 'stay' as const,
    id: stay.id,
    title: stay.name,
    date: stay.checkInDate,
    category: 'HOTEL' as const,
    amount: stay.priceAmount,
    currency: stay.priceCurrency,
  }));
  const flightSources = trip.flights.map(flight => ({
    kind: 'flight' as const,
    id: flight.id,
    title: `${flight.flightNumber}${
      flight.departureAirportIata || flight.arrivalAirportIata
        ? ` · ${flight.departureAirportIata ?? '—'} → ${flight.arrivalAirportIata ?? '—'}`
        : ''
    }`,
    date: flight.departureDate,
    category: 'FLIGHT' as const,
  }));
  const scheduleSources = trip.schedule.map(item => ({
    kind: 'schedule' as const,
    id: item.id,
    title:
      trip.places.find(place => place.id === item.savedPlaceId)?.name ?? item.title ?? 'Activity',
    date: item.date,
    category: activityExpenseCategory(item),
    amount: item.amount,
    currency: item.currency,
  }));

  return [...staySources, ...flightSources, ...scheduleSources].sort(
    (left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title),
  );
}

export function groupedExpenseTotals(expenses: Expense[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amount);
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

export function perDayExpenseTotals(expenses: Expense[]) {
  const byDate = new Map<string, Expense[]>();
  for (const expense of expenses) {
    byDate.set(expense.expenseDate, [...(byDate.get(expense.expenseDate) ?? []), expense]);
  }
  return [...byDate.entries()]
    .map(([date, dayExpenses]) => ({ date, totals: groupedExpenseTotals(dayExpenses) }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function categoryExpenseTotals(expenses: Expense[], category: ExpenseCategory) {
  return groupedExpenseTotals(expenses.filter(expense => expense.category === category));
}

export function activityExpenseTotals(expenses: Expense[]) {
  return groupedExpenseTotals(expenses.filter(expense => activityCategories.has(expense.category)));
}

export function categoryBreakdown(expenses: Expense[], currency: string) {
  const total = expenses
    .filter(expense => expense.currency === currency)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return expenseCategories
    .map(category => ({
      category,
      amount: expenses
        .filter(expense => expense.currency === currency && expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter(item => item.amount > 0)
    .map(item => ({ ...item, percentage: total ? (item.amount / total) * 100 : 0 }))
    .sort((left, right) => right.amount - left.amount);
}

export function visibleExpenses(expenses: Expense[], filter: ExpenseCategory | 'ALL') {
  return expenses
    .filter(expense => filter === 'ALL' || expense.category === filter)
    .sort(
      (left, right) =>
        right.expenseDate.localeCompare(left.expenseDate) || right.title.localeCompare(left.title),
    );
}

export function missingExpenseSources(expenses: Expense[], sources: ExpenseSource[]) {
  const linkedSourceIds = new Set(
    expenses.flatMap(expense => [
      ...(expense.stayId ? [`stay:${expense.stayId}`] : []),
      ...(expense.flightId ? [`flight:${expense.flightId}`] : []),
      ...(expense.scheduleItemId ? [`schedule:${expense.scheduleItemId}`] : []),
    ]),
  );
  return sources.filter(source => !linkedSourceIds.has(`${source.kind}:${source.id}`));
}

export function isExpenseSourceKind(value: string | undefined): value is ExpenseSourceKind {
  return value === 'stay' || value === 'flight' || value === 'schedule';
}

export function newExpenseForm(
  trip: Pick<TripEditorTrip, 'defaultCurrency' | 'startDate'>,
  source?: ExpenseSource,
): ExpenseEditorValues {
  return {
    title: source?.title ?? '',
    category: source?.category ?? 'OTHER',
    amount: source?.amount == null ? '' : String(source.amount),
    currency: source?.currency ?? trip.defaultCurrency,
    expenseDate: source?.date ?? trip.startDate,
    notes: '',
    sourceKind: source?.kind ?? 'none',
    sourceId: source?.id ?? '',
  };
}

export function applyExpenseSource(
  form: ExpenseEditorValues,
  source: ExpenseSource,
): ExpenseEditorValues {
  return {
    ...form,
    title: form.title.trim() || source.title,
    category: source.category,
    amount: source.amount == null ? form.amount : String(source.amount),
    currency: source.currency ?? form.currency,
    expenseDate: source.date,
    sourceKind: source.kind,
    sourceId: source.id,
  };
}
