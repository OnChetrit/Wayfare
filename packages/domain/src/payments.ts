import { z } from 'zod';
import { moneyFromMinorUnits, moneyMinorUnits } from './money';

export const paymentStatuses = ['UNPAID', 'PAID', 'NEEDS_REVIEW'] as const;
export const paymentStatusSchema = z.enum(paymentStatuses);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PAID: 'Paid',
  UNPAID: 'Unpaid',
  NEEDS_REVIEW: 'Needs review',
};
export const itemKinds = ['ACTIVITY', 'HOTEL', 'FLIGHT'] as const;
export const expenseItemSchema = z.object({
  kind: z.enum(itemKinds),
  itemId: z.uuid().nullable(),
  title: z.string(),
  date: z.string(),
  category: z.string(),
  allocatedAmount: z.string().nullable().optional(),
});
export type ExpenseItem = z.infer<typeof expenseItemSchema>;
export const coverageInputSchema = expenseItemSchema
  .pick({ kind: true, itemId: true, allocatedAmount: true })
  .extend({ itemId: z.uuid() });

export function validateAllocation(
  total: number | string,
  currency: string,
  items: readonly Pick<ExpenseItem, 'allocatedAmount'>[],
) {
  const expected = moneyMinorUnits(total, currency);
  const allocated = items.filter(item => item.allocatedAmount != null);
  if (!allocated.length) return;
  if (allocated.length !== items.length)
    throw new Error('Allocate every covered item or leave all shares blank.');
  const sum = allocated.reduce(
    (amount, item) => amount + moneyMinorUnits(item.allocatedAmount!, currency),
    0n,
  );
  if (sum !== expected) throw new Error('Allocated shares must equal the payment total exactly.');
}

export function paymentTotals(
  expenses: readonly { amount: number; currency: string; paymentStatus?: PaymentStatus }[],
) {
  const totals: Record<string, Record<PaymentStatus, bigint>> = {};
  for (const expense of expenses) {
    const group = (totals[expense.currency] ??= { PAID: 0n, UNPAID: 0n, NEEDS_REVIEW: 0n });
    group[expense.paymentStatus ?? 'NEEDS_REVIEW'] += moneyMinorUnits(
      expense.amount,
      expense.currency,
    );
  }
  return Object.fromEntries(
    Object.entries(totals).map(([currency, totals]) => [
      currency,
      Object.fromEntries(
        paymentStatuses.map(status => [status, moneyFromMinorUnits(totals[status], currency)]),
      ) as Record<PaymentStatus, string>,
    ]),
  );
}
