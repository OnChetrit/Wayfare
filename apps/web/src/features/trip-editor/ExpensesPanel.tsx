'use client';
import { TripItemTools, TripItemContext } from './TripItemTools';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BedDouble,
  BusFront,
  Check,
  MoreHorizontal,
  Pencil,
  Plane,
  Plus,
  ShoppingBag,
  Ticket,
  Trash2,
  Utensils,
  WalletCards,
  X,
} from 'lucide-react';
import {
  currencyTotals,
  formatMoney,
  moneyMinorUnits,
  paymentStatusLabels,
  paymentTotals,
  splitMoneyEqually,
  validateAllocation,
  type Expense,
  type ExpenseCategory,
  type PaymentStatus,
  type ExpenseItem,
  type SavedPlace,
  type ScheduleItem,
  type Stay,
  type TripDay,
  type TripFlight,
} from '@wayfare/domain';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import {
  expenseCategories,
  expenseCategoryLabels,
  expenseFromDatabase,
} from '@/lib/trips/expenses';
import styles from './ExpensesPanel.module.scss';

const categoryIcons: Record<ExpenseCategory, typeof Plane> = {
  FLIGHT: Plane,
  HOTEL: BedDouble,
  RESTAURANT: Utensils,
  TICKETS: Ticket,
  SHOPPING: ShoppingBag,
  TRANSPORT: BusFront,
  OTHER: MoreHorizontal,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function categoryMoney(expenses: Expense[], category: ExpenseCategory) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.category !== category) continue;
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amount);
  }
  return (
    [...totals]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amount]) => formatMoney(amount, currency))
      .join(' · ') || '—'
  );
}

type Props = {
  tripId: string;
  tripStartDate: string;
  tripEndDate: string;
  defaultCurrency: string;
  expenses: Expense[];
  stays: Stay[];
  flights: TripFlight[];
  schedule: ScheduleItem[];
  places: SavedPlace[];
  days: TripDay[];
  onExpensesChange: (expenses: Expense[]) => void;
  onLinkedStayPriceChange: (id: string, amount: number, currency: string) => void;
};
export function ExpensesPanel(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canEdit = useContext(TripItemContext)?.access.canEdit ?? false;
  const { tripId, expenses, defaultCurrency, onExpensesChange } = props;
  const [editing, setEditing] = useState<Expense | null | undefined>();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [date, setDate] = useState(props.tripStartDate);
  const [status, setStatus] = useState<PaymentStatus>('UNPAID');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [coverage, setCoverage] = useState<ExpenseItem[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [combineIds, setCombineIds] = useState<string[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editing !== undefined && !dialog.open) dialog.showModal();
    if (editing === undefined && dialog.open) dialog.close();
  }, [editing]);

  const sources: ExpenseItem[] = [
    ...props.flights.map(item => ({
      kind: 'FLIGHT' as const,
      itemId: item.id,
      title: item.flightNumber,
      date: item.departureDate,
      category: 'FLIGHT',
    })),
    ...props.stays.map(item => ({
      kind: 'HOTEL' as const,
      itemId: item.id,
      title: item.name,
      date: item.checkInDate,
      category: 'HOTEL',
    })),
    ...props.schedule.map(item => ({
      kind: 'ACTIVITY' as const,
      itemId: item.id,
      title:
        item.title ??
        props.places.find(place => place.id === item.savedPlaceId)?.name ??
        'Activity',
      date: item.date,
      category: 'OTHER',
    })),
  ];
  function open(expense: Expense | null) {
    setEditing(expense);
    setTitle(expense?.title ?? '');
    setAmount(expense ? String(expense.amount) : '');
    setCurrency(expense?.currency ?? defaultCurrency);
    setCategory(expense?.category ?? 'OTHER');
    setDate(expense?.expenseDate ?? props.tripStartDate);
    setStatus(expense?.paymentStatus ?? (expense ? 'NEEDS_REVIEW' : 'UNPAID'));
    setPaymentDate(expense?.paymentDate ?? '');
    setNotes(expense?.notes ?? '');
    setError('');
    setQuery('');
    setCoverage(
      expense?.coverage ??
        sources.filter(
          item =>
            item.itemId === expense?.stayId ||
            item.itemId === expense?.flightId ||
            item.itemId === expense?.scheduleItemId,
        ),
    );
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      moneyMinorUnits(amount, currency);
      validateAllocation(amount, currency, coverage);
      const confirmPaid = editing?.paymentStatus === 'PAID' && status === 'PAID';
      if (
        confirmPaid &&
        !window.confirm(
          `Save changes to ${title}? Confirm the revised ${formatMoney(amount, currency)} payment remains paid.`,
        )
      )
        return;
      const moveFrom: Record<string, number> = {};
      for (const item of coverage) {
        const other = expenses.find(
          expense =>
            expense.id !== editing?.id &&
            expense.coverage?.some(
              link => link.itemId && link.itemId === item.itemId && link.kind === item.kind,
            ),
        );
        if (other) {
          if (
            !window.confirm(
              `Move ${item.title} from ${other.title} (${formatMoney(other.amount, other.currency)}) to this expense? The previous total, notes, and receipts will be preserved.`,
            )
          )
            return;
          moveFrom[other.id] = other.version!;
        }
      }
      setSaving(true);
      const response = await fetch(
        `/api/trips/${tripId}/expenses${editing ? `/${editing.id}` : ''}`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            category,
            amount: Number(amount),
            currency,
            expenseDate: date,
            paymentStatus: status,
            paymentDate: paymentDate || null,
            notes,
            coverage: coverage.filter(item => item.itemId),
            expectedVersion: editing?.version,
            confirmPaid,
            moveFrom,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const saved = expenseFromDatabase(body.expense);
      onExpensesChange(
        editing
          ? expenses.map(item => (item.id === editing.id ? saved : item))
          : [...expenses, saved],
      );
      setEditing(undefined);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove(expense: Expense) {
    if (
      !window.confirm(
        `Delete ${expense.title}? Itinerary items remain, and their payment indicators will be removed.`,
      )
    )
      return;
    const response = await fetch(`/api/trips/${tripId}/expenses/${expense.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setError('Could not delete this payment.');
      return;
    }
    onExpensesChange(expenses.filter(item => item.id !== expense.id));
  }
  async function combine() {
    const selected = expenses.filter(item => combineIds.includes(item.id));
    if (selected.length < 2) return;
    if (new Set(selected.map(item => item.currency)).size !== 1) {
      setError('Only payments in the same currency can be combined.');
      return;
    }
    const total = currencyTotals(selected)[selected[0].currency];
    const choice = window.prompt(
      `Combine ${selected.map(item => item.title).join(', ')} into ${formatMoney(total, selected[0].currency)}? All items, documents, and notes will be retained. Enter PAID or UNPAID for the combined status.`,
      selected.every(item => item.paymentStatus === 'PAID') ? 'PAID' : 'UNPAID',
    );
    if (choice !== 'PAID' && choice !== 'UNPAID') return;
    const response = await fetch(`/api/trips/${tripId}/expenses/combine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenses: selected.map(item => ({ id: item.id, version: item.version })),
        paymentStatus: choice,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    onExpensesChange([
      ...expenses.filter(item => !combineIds.includes(item.id)),
      expenseFromDatabase(body.expense),
    ]);
    setCombineIds([]);
  }
  const totals = paymentTotals(expenses);
  const uncoveredCount = sources.filter(
    source =>
      !expenses.some(expense =>
        expense.coverage?.some(item => item.kind === source.kind && item.itemId === source.itemId),
      ),
  ).length;

  return (
    <section className={styles.panel} data-enter>
      <div className={styles.header}>
        <div>
          <h1>What will this trip cost?</h1>
          <p>Track estimates and payments without changing reservation details.</p>
        </div>
        <button
          type="button"
          className={styles.addButton}
          disabled={!canEdit}
          onClick={() => open(null)}
        >
          <Plus size={15} /> Add expense
        </button>
      </div>

      <div className={styles.summaryGrid}>
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
                  <strong>{currencyCode}</strong>
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
            <strong className={styles.totalEmpty}>—</strong>
          )}
          <small className={styles.totalFooter}>
            Original currencies stay separate. Changing the trip default does not convert totals.
          </small>
        </div>
        <SummaryCard category="FLIGHT" value={categoryMoney(expenses, 'FLIGHT')} />
        <SummaryCard category="HOTEL" value={categoryMoney(expenses, 'HOTEL')} />
        <SummaryCard category="TICKETS" value={categoryMoney(expenses, 'TICKETS')} />
      </div>

      {uncoveredCount > 0 ? (
        <div className={styles.missingNotice} role="status">
          <AlertCircle size={17} />
          <span>
            {uncoveredCount} itinerary {uncoveredCount === 1 ? 'item has' : 'items have'} no payment
            recorded yet.
          </span>
        </div>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.contentGrid}>
        <div className={styles.expenseListCard}>
          <div className={styles.listHeader}>
            <div>
              <h2>All expenses</h2>
              <p className={styles.listHint}>Select rows to combine payments in one currency.</p>
            </div>
            {combineIds.length > 1 ? (
              <button
                type="button"
                className={styles.addButton}
                disabled={!canEdit}
                onClick={() => void combine()}
              >
                Combine {combineIds.length}
              </button>
            ) : null}
          </div>
          {expenses.length ? (
            <div className={styles.expenseRows}>
              {expenses.map(expense => {
                const Icon = categoryIcons[expense.category];
                const status = expense.paymentStatus ?? 'NEEDS_REVIEW';
                return (
                  <article className={styles.expenseRow} key={expense.id}>
                    <label className={styles.rowSelect}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${expense.title} to combine`}
                        checked={combineIds.includes(expense.id)}
                        onChange={event =>
                          setCombineIds(current =>
                            event.target.checked
                              ? [...current, expense.id]
                              : current.filter(id => id !== expense.id),
                          )
                        }
                      />
                    </label>
                    <span className={styles.expenseIcon}>
                      <Icon size={16} />
                    </span>
                    <button
                      type="button"
                      className={styles.expenseCopyButton}
                      onClick={() => open(expense)}
                    >
                      <span className={styles.expenseCopy}>
                        <strong>{expense.title}</strong>
                        <span>
                          {expenseCategoryLabels[expense.category]} ·{' '}
                          {formatDate(expense.expenseDate)}
                          {expense.coverage?.length
                            ? ` · ${expense.coverage.length} covered ${expense.coverage.length === 1 ? 'item' : 'items'}`
                            : ''}
                        </span>
                      </span>
                    </button>
                    <div className={styles.expenseStatus} data-status={status}>
                      {status === 'PAID' ? <Check size={13} /> : null}
                      {paymentStatusLabels[status]}
                    </div>
                    <strong className={styles.expenseAmount}>
                      {formatMoney(expense.amount, expense.currency)}
                    </strong>
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => open(expense)} aria-label="Edit expense">
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => void remove(expense)}
                        aria-label="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <WalletCards size={22} />
              <strong>No expenses yet</strong>
              <p>Add a payment and optionally connect it to itinerary items.</p>
              <button type="button" disabled={!canEdit} onClick={() => open(null)}>
                <Plus size={14} /> Add an expense
              </button>
            </div>
          )}
        </div>

        <aside className={styles.categoryCard}>
          <h2>Where it goes</h2>
          <div className={styles.categoryRows}>
            {expenseCategories.map(expenseCategory => {
              const Icon = categoryIcons[expenseCategory];
              return (
                <div className={styles.categoryRow} key={expenseCategory}>
                  <div className={styles.categoryLabel}>
                    <Icon size={14} />
                    <span>{expenseCategoryLabels[expenseCategory]}</span>
                    <strong>{categoryMoney(expenses, expenseCategory)}</strong>
                  </div>
                  <div className={styles.barTrack}>
                    <span
                      style={{
                        width: expenses.some(expense => expense.category === expenseCategory)
                          ? '100%'
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <dialog
        ref={dialogRef}
        className={styles.form}
        aria-labelledby="expense-form-heading"
        onClick={event => {
          if (event.target === event.currentTarget) setEditing(undefined);
        }}
        onCancel={event => {
          event.preventDefault();
          setEditing(undefined);
        }}
        onClose={() => setEditing(undefined)}
      >
        <form className={styles.formContent} onSubmit={save}>
          <div className={styles.formHeader}>
            <h2 id="expense-form-heading">{editing ? 'Payment details' : 'Add an expense'}</h2>
            <button type="button" onClick={() => setEditing(undefined)} aria-label="Close">
              <X size={17} />
            </button>
          </div>
          {editing && <TripItemTools kind="EXPENSE" itemId={editing.id} />}
          <label>
            Expense name
            <input required value={title} onChange={event => setTitle(event.target.value)} />
          </label>
          <div className={styles.formColumns}>
            <label>
              Amount
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={event => setAmount(event.target.value)}
              />
            </label>
            <label>
              Currency
              <CurrencyPicker
                value={currency}
                onChange={setCurrency}
                preferred={[defaultCurrency, ...expenses.map(item => item.currency)]}
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={event => setCategory(event.target.value as ExpenseCategory)}
              >
                {expenseCategories.map(item => (
                  <option key={item} value={item}>
                    {expenseCategoryLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Payment status
              <select
                value={status}
                onChange={event => setStatus(event.target.value as PaymentStatus)}
              >
                {status === 'NEEDS_REVIEW' ? (
                  <option value="NEEDS_REVIEW">Needs review</option>
                ) : null}
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
          </div>
          <label>
            Expense date
            <input
              type="date"
              required
              value={date}
              onChange={event => setDate(event.target.value)}
            />
          </label>
          <label>
            Payment date (optional)
            <input
              type="date"
              value={paymentDate}
              onChange={event => setPaymentDate(event.target.value)}
            />
          </label>
          <fieldset className={styles.coverageFieldset}>
            <legend>Covered reservations</legend>
            <input
              className={styles.coverageSearch}
              aria-label="Search reservations"
              placeholder="Search flights, hotels, and activities"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            {(['FLIGHT', 'HOTEL', 'ACTIVITY'] as const).map(kind => (
              <div className={styles.coverageGroup} key={kind}>
                <strong>
                  {kind === 'FLIGHT' ? 'Flights' : kind === 'HOTEL' ? 'Hotels' : 'Activities'}
                </strong>
                {sources
                  .filter(
                    item =>
                      item.kind === kind &&
                      `${item.title} ${item.date}`.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map(item => (
                    <label className={styles.coverageOption} key={item.itemId}>
                      <input
                        type="checkbox"
                        checked={coverage.some(link => link.itemId === item.itemId)}
                        onChange={event =>
                          setCoverage(current =>
                            event.target.checked
                              ? [...current, item]
                              : current.filter(link => link.itemId !== item.itemId),
                          )
                        }
                      />
                      {item.title} · {item.date}
                    </label>
                  ))}
              </div>
            ))}
            {coverage.map((item, index) => (
              <label key={`${item.itemId}:${index}`}>
                {item.title} share (optional)
                <input
                  inputMode="decimal"
                  value={item.allocatedAmount ?? ''}
                  onChange={event =>
                    setCoverage(current =>
                      current.map((link, position) =>
                        position === index
                          ? { ...link, allocatedAmount: event.target.value || null }
                          : link,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className={styles.cancelButton}
              disabled={!coverage.length}
              onClick={() => {
                try {
                  const shares = splitMoneyEqually(amount, currency, coverage.length);
                  setCoverage(current =>
                    current.map((item, index) => ({ ...item, allocatedAmount: shares[index] })),
                  );
                } catch (failure) {
                  setError((failure as Error).message);
                }
              }}
            >
              Split equally
            </button>
          </fieldset>
          <label>
            Notes
            <textarea value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => setEditing(undefined)}
            >
              Cancel
            </button>
            <button className={styles.saveButton} disabled={saving || !canEdit} type="submit">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

function SummaryCard({ category, value }: { category: ExpenseCategory; value: string }) {
  const Icon = categoryIcons[category];
  return (
    <div className={styles.summaryCard}>
      <span>
        <Icon size={13} /> {expenseCategoryLabels[category]}
      </span>
      <strong>{value}</strong>
      <small>Recorded so far</small>
    </div>
  );
}
