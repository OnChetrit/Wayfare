import { currencyTotals, formatMoney, paymentTotals, type Expense } from '@wayfare/domain';
import styles from './ExpensesPanel.module.scss';

type PaymentTotalsProps = {
  expenses: Expense[];
  defaultCurrency: string;
};

export function PaymentTotals({ expenses, defaultCurrency }: PaymentTotalsProps) {
  const totals = paymentTotals(expenses);
  const totalByCurrency = currencyTotals(expenses);

  return (
    <div className={`${styles.summaryCard} ${styles.summaryCardTotal}`}>
      <div className={styles.totalHeading}>
        <span>Payment totals</span>
        <small>
          {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
        </small>
      </div>
      {Object.entries(totals).length ? (
        <div className={styles.totalAmounts}>
          {Object.entries(totals).map(([currencyCode, statusTotals]) => (
            <div className={styles.totalAmount} key={currencyCode}>
              <strong>{formatMoney(totalByCurrency[currencyCode], currencyCode)}</strong>
              <span>
                Paid {formatMoney(statusTotals.PAID, currencyCode)} · Unpaid{' '}
                {formatMoney(statusTotals.UNPAID, currencyCode)}
              </span>
              {Number(statusTotals.NEEDS_REVIEW) > 0 ? (
                <span>Needs review {formatMoney(statusTotals.NEEDS_REVIEW, currencyCode)}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <strong className={styles.totalEmpty}>{formatMoney(0, defaultCurrency)}</strong>
      )}
      <small className={styles.totalFooter}>
        Original currencies stay separate. Changing the trip default does not convert totals.
      </small>
    </div>
  );
}
