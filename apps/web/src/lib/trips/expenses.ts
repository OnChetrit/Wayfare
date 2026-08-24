import { z } from 'zod';
import type { Expense, ExpenseCategory } from '@/features/trip-editor/types';
import { currencySchema } from './currencies';

export const expenseCategories: ExpenseCategory[] = [
  'FLIGHT',
  'HOTEL',
  'RESTAURANT',
  'TICKETS',
  'SHOPPING',
  'TRANSPORT',
  'OTHER',
];

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  FLIGHT: 'Flights',
  HOTEL: 'Hotels',
  RESTAURANT: 'Restaurants',
  TICKETS: 'Tickets',
  SHOPPING: 'Shopping',
  TRANSPORT: 'Transport',
  OTHER: 'Other',
};

export const expenseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(expenseCategories),
  amount: z.coerce.number().finite().nonnegative(),
  currency: currencySchema,
  expenseDate: z.iso.date(),
  notes: z.string().trim().max(2000).nullable().optional(),
  stayId: z.uuid().nullable().optional(),
  flightId: z.uuid().nullable().optional(),
  scheduleItemId: z.uuid().nullable().optional(),
});

export const expenseUpdateSchema = expenseSchema
  .partial()
  .refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const expenseSelect =
  'id, trip_id, title, category, amount, currency, expense_date, notes, stay_id, flight_id, schedule_item_id';

export function expenseFromDatabase(row: {
  id: string;
  trip_id: string;
  title: string;
  category: string;
  amount: number | string;
  currency: string;
  expense_date: string;
  notes: string | null;
  stay_id: string | null;
  flight_id: string | null;
  schedule_item_id: string | null;
}): Expense {
  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
    currency: row.currency,
    expenseDate: row.expense_date,
    notes: row.notes ?? undefined,
    stayId: row.stay_id ?? undefined,
    flightId: row.flight_id ?? undefined,
    scheduleItemId: row.schedule_item_id ?? undefined,
  };
}

export function sumExpenses(expenses: Expense[], currency?: string) {
  return expenses
    .filter(expense => !currency || expense.currency === currency)
    .reduce((total, expense) => total + expense.amount, 0);
}

export function categoryTotals(expenses: Expense[], currency?: string) {
  return expenseCategories.reduce<Record<ExpenseCategory, number>>(
    (totals, category) => {
      totals[category] = expenses
        .filter(expense => !currency || expense.currency === currency)
        .filter(expense => expense.category === category)
        .reduce((total, expense) => total + expense.amount, 0);
      return totals;
    },
    {
      FLIGHT: 0,
      HOTEL: 0,
      RESTAURANT: 0,
      TICKETS: 0,
      SHOPPING: 0,
      TRANSPORT: 0,
      OTHER: 0,
    },
  );
}
