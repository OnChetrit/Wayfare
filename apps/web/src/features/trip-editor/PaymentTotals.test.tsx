import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatMoney, type Expense } from '@wayfare/domain';
import { PaymentTotals } from './PaymentTotals';

const baseExpense: Expense = {
  id: 'expense-1',
  tripId: 'trip-1',
  title: 'Tickets',
  category: 'TICKETS',
  amount: 5,
  currency: 'USD',
  expenseDate: '2026-10-25',
  paymentStatus: 'PAID',
};

function paymentSummary(expenses: Expense[]) {
  const markup = renderToStaticMarkup(
    createElement(PaymentTotals, {
      defaultCurrency: 'USD',
      expenses,
    }),
  );
  return markup.split('Payment totals')[1].split('Original currencies')[0];
}

describe('expenses payment summary', () => {
  it('shows the full amount for each currency above its payment status breakdown', () => {
    const summary = paymentSummary([
      baseExpense,
      { ...baseExpense, id: 'expense-2', amount: 10, paymentStatus: 'UNPAID' },
      {
        ...baseExpense,
        id: 'expense-3',
        amount: 100,
        currency: 'JPY',
        paymentStatus: 'NEEDS_REVIEW',
      },
    ]);

    expect(summary).toContain(`<strong>${formatMoney(15, 'USD')}</strong>`);
    expect(summary).toContain(`<strong>${formatMoney(100, 'JPY')}</strong>`);
    expect(summary).toContain(`Paid ${formatMoney(5, 'USD')}`);
    expect(summary).toContain(`Unpaid ${formatMoney(10, 'USD')}`);
  });

  it('shows zero in the trip currency before any expenses are added', () => {
    expect(paymentSummary([])).toContain(formatMoney(0, 'USD'));
  });
});
