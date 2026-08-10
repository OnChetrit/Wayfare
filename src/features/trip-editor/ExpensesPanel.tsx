'use client';

import {
  AlertCircle,
  BedDouble,
  BusFront,
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
import { useMemo, useState } from 'react';
import styles from './ExpensesPanel.module.scss';
import {
  expenseCategories,
  expenseCategoryLabels,
  expenseFromDatabase,
} from '@/lib/trips/expenses';
import { currencyLabels, supportedCurrencies } from '@/lib/trips/currencies';
import type {
  Expense,
  ExpenseCategory,
  SavedPlace,
  ScheduleItem,
  Stay,
  TripDay,
  TripFlight,
} from './types';

type ExpenseSource = {
  key: string;
  label: string;
  date: string;
  category: ExpenseCategory;
  amount?: number;
  currency?: string;
  stayId?: string;
  flightId?: string;
  scheduleItemId?: string;
};

type ExpensesPanelProps = {
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
  onLinkedStayPriceChange: (stayId: string, amount: number, currency: string) => void;
};

const categoryIcons: Record<ExpenseCategory, typeof Plane> = {
  FLIGHT: Plane,
  HOTEL: BedDouble,
  RESTAURANT: Utensils,
  TICKETS: Ticket,
  SHOPPING: ShoppingBag,
  TRANSPORT: BusFront,
  OTHER: MoreHorizontal,
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function groupedExpenseTotals(expenses: Expense[]) {
  const totals = new Map<string, number>();
  expenses.forEach(expense =>
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amount),
  );
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function formatCategoryMoney(expenses: Expense[], category: ExpenseCategory) {
  const totals = new Map<string, number>();
  expenses
    .filter(expense => expense.category === category)
    .forEach(expense =>
      totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amount),
    );
  return (
    [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entryCurrency, value]) => formatMoney(value, entryCurrency))
      .join(' · ') || '—'
  );
}

function formatActivityMoney(expenses: Expense[]) {
  const grouped = ['RESTAURANT', 'TICKETS', 'SHOPPING', 'TRANSPORT', 'OTHER']
    .flatMap(category => expenses.filter(expense => expense.category === category))
    .reduce<Record<string, number>>((grouped, expense) => {
      grouped[expense.currency] = (grouped[expense.currency] ?? 0) + expense.amount;
      return grouped;
    }, {});
  return (
    Object.entries(grouped)
      .map(([entryCurrency, value]) => formatMoney(value, entryCurrency))
      .join(' · ') || '—'
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function activityExpenseCategory(item: ScheduleItem): ExpenseCategory {
  if (item.category === 'RESTAURANT' || item.category === 'CAFE' || item.category === 'BAR') {
    return 'RESTAURANT';
  }
  if (item.category === 'SHOPPING') return 'SHOPPING';
  if (item.category === 'TRANSPORT') return 'TRANSPORT';
  if (item.category === 'ATTRACTION') return 'TICKETS';
  return 'OTHER';
}

function errorMessage(value: unknown) {
  if (!value || typeof value !== 'object') return 'Could not save this expense.';
  const payload = value as { error?: { message?: string } | string };
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error && typeof payload.error.message === 'string') return payload.error.message;
  return 'Could not save this expense.';
}

export function ExpensesPanel({
  tripId,
  tripStartDate,
  tripEndDate,
  defaultCurrency,
  expenses,
  stays,
  flights,
  schedule,
  places,
  days,
  onExpensesChange,
  onLinkedStayPriceChange,
}: ExpensesPanelProps) {
  const [filter, setFilter] = useState<'ALL' | ExpenseCategory>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [amount, setAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState(defaultCurrency);
  const [expenseDate, setExpenseDate] = useState(tripStartDate);
  const [notes, setNotes] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editingExpense = editingId ? expenses.find(expense => expense.id === editingId) : undefined;
  const editingLinkedSource = isSourceLocked(editingExpense);

  const sources = useMemo<ExpenseSource[]>(() => {
    const staySources = stays.map(stay => ({
      key: `stay:${stay.id}`,
      label: `Hotel · ${stay.name}`,
      date: stay.checkInDate,
      category: 'HOTEL' as const,
      amount: stay.priceAmount,
      currency: stay.priceCurrency,
      stayId: stay.id,
    }));
    const flightSources = flights.map(flight => ({
      key: `flight:${flight.id}`,
      label: `Flight · ${flight.flightNumber} ${flight.departureAirportIata ?? ''} → ${flight.arrivalAirportIata ?? ''}`,
      date: flight.departureDate,
      category: 'FLIGHT' as const,
      flightId: flight.id,
    }));
    const activitySources = schedule.map(item => {
      const place = places.find(candidate => candidate.id === item.savedPlaceId);
      return {
        key: `schedule:${item.id}`,
        label: `Activity · ${place?.name ?? item.title ?? 'Untitled activity'}`,
        date: item.date,
        category: activityExpenseCategory(item),
        scheduleItemId: item.id,
      };
    });
    return [...staySources, ...flightSources, ...activitySources].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [flights, places, schedule, stays]);

  const tripDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${tripEndDate}T12:00:00Z`) - Date.parse(`${tripStartDate}T12:00:00Z`)) /
        86400000,
    ) + 1,
  );
  const totalByCurrency = groupedExpenseTotals(expenses);
  const visibleExpenses = expenses
    .filter(expense => filter === 'ALL' || expense.category === filter)
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const linkedStays = new Set(expenses.map(expense => expense.stayId).filter(Boolean));
  const linkedFlights = new Set(expenses.map(expense => expense.flightId).filter(Boolean));
  const linkedActivities = new Set(expenses.map(expense => expense.scheduleItemId).filter(Boolean));
  const missingCount =
    stays.filter(stay => !linkedStays.has(stay.id)).length +
    flights.filter(flight => !linkedFlights.has(flight.id)).length +
    schedule.filter(item => !linkedActivities.has(item.id)).length;

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setCategory('OTHER');
    setAmount('');
    setExpenseCurrency(defaultCurrency);
    setExpenseDate(tripStartDate);
    setNotes('');
    setSourceKey('');
    setError('');
  }

  function openNew() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id);
    setTitle(expense.title);
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setExpenseCurrency(expense.currency);
    setExpenseDate(expense.expenseDate);
    setNotes(expense.notes ?? '');
    setSourceKey(
      expense.stayId
        ? `stay:${expense.stayId}`
        : expense.flightId
          ? `flight:${expense.flightId}`
          : expense.scheduleItemId
            ? `schedule:${expense.scheduleItemId}`
            : '',
    );
    setError('');
    setFormOpen(true);
  }

  function isSourceLocked(expense: Expense | undefined) {
    return Boolean(expense?.stayId || expense?.flightId);
  }

  function chooseSource(value: string) {
    setSourceKey(value);
    const source = sources.find(item => item.key === value);
    if (!source) return;
    setCategory(source.category);
    setExpenseDate(source.date);
    if (source.amount != null) setAmount(String(source.amount));
    if (source.currency) setExpenseCurrency(source.currency);
    if (!title.trim()) setTitle(source.label.split(' · ').slice(1).join(' · '));
  }

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(numericAmount) || numericAmount < 0 || !expenseDate) {
      setError('Add a title, a valid amount, and a date.');
      return;
    }
    const source = sources.find(item => item.key === sourceKey);
    const payload = {
      amount: numericAmount,
      currency: expenseCurrency,
      notes: notes.trim() || null,
      ...(editingLinkedSource
        ? {}
        : {
            title: title.trim(),
            category,
            expenseDate,
            stayId: source?.stayId ?? null,
            flightId: source?.flightId ?? null,
            scheduleItemId: source?.scheduleItemId ?? null,
          }),
    };
    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        editingId ? `/api/trips/${tripId}/expenses/${editingId}` : `/api/trips/${tripId}/expenses`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        expense?: Parameters<typeof expenseFromDatabase>[0];
      };
      if (!response.ok || !body.expense) throw new Error(errorMessage(body));
      const saved = expenseFromDatabase(body.expense);
      onExpensesChange(
        editingId
          ? expenses.map(expense => (expense.id === editingId ? saved : expense))
          : [...expenses, saved],
      );
      if (saved.stayId) onLinkedStayPriceChange(saved.stayId, saved.amount, saved.currency);
      setFormOpen(false);
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this expense.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!window.confirm(`Delete ${expense.title}?`)) return;
    const response = await fetch(`/api/trips/${tripId}/expenses/${expense.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setError('Could not delete this expense.');
      return;
    }
    onExpensesChange(expenses.filter(item => item.id !== expense.id));
  }

  return (
    <section className={styles.panel} data-enter>
      <div className={styles.header}>
        <div>
          <h1>What will this trip cost?</h1>
          <p>Keep hotels, flights, and every memorable stop in one place.</p>
        </div>
        <button type="button" className={styles.addButton} onClick={openNew}>
          <Plus size={15} /> Add expense
        </button>
      </div>

      <div className={styles.summaryGrid}>
        <div className={`${styles.summaryCard} ${styles.summaryCardTotal}`}>
          <div className={styles.totalHeading}>
            <span>Total trip cost</span>
            <small>
              {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
            </small>
          </div>
          {totalByCurrency.length ? (
            <div className={styles.totalAmounts}>
              {totalByCurrency.map(([currency, value]) => (
                <div className={styles.totalAmount} key={currency}>
                  <strong>{formatMoney(value, currency)}</strong>
                  <span>{formatMoney(value / tripDays, currency)} per day</span>
                </div>
              ))}
            </div>
          ) : (
            <strong className={styles.totalEmpty}>—</strong>
          )}
          <small className={styles.totalFooter}>
            {tripDays} {tripDays === 1 ? 'day' : 'days'} · Totals are grouped by currency
          </small>
        </div>
        <SummaryCard category="FLIGHT" value={formatCategoryMoney(expenses, 'FLIGHT')} />
        <SummaryCard category="HOTEL" value={formatCategoryMoney(expenses, 'HOTEL')} />
        <div className={styles.summaryCard}>
          <span>Activities</span>
          <strong>{formatActivityMoney(expenses)}</strong>
          <small>Food, tickets, shopping & more</small>
        </div>
      </div>

      {missingCount > 0 && (
        <div className={styles.missingNotice} role="status">
          <AlertCircle size={17} />
          <span>
            {missingCount} itinerary {missingCount === 1 ? 'item has' : 'items have'} no expense
            recorded yet.
          </span>
        </div>
      )}

      <div className={styles.contentGrid}>
        <div className={styles.expenseListCard}>
          <div className={styles.listHeader}>
            <div>
              <h2>All expenses</h2>
            </div>
            <select
              value={filter}
              onChange={event => setFilter(event.target.value as 'ALL' | ExpenseCategory)}
              aria-label="Filter expenses by category"
            >
              <option value="ALL">All categories</option>
              {expenseCategories.map(item => (
                <option key={item} value={item}>
                  {expenseCategoryLabels[item]}
                </option>
              ))}
            </select>
          </div>
          {visibleExpenses.length ? (
            <div className={styles.expenseRows}>
              {visibleExpenses.map(expense => {
                const Icon = categoryIcons[expense.category];
                const sourceLocked = isSourceLocked(expense);
                return (
                  <div className={styles.expenseRow} key={expense.id}>
                    <span className={styles.expenseIcon}>
                      <Icon size={16} />
                    </span>
                    <div className={styles.expenseCopy}>
                      <strong>{expense.title}</strong>
                      <span>
                        {expenseCategoryLabels[expense.category]} ·{' '}
                        {formatDate(expense.expenseDate)}
                        {expense.notes ? ` · ${expense.notes}` : ''}
                      </span>
                    </div>
                    <strong className={styles.expenseAmount}>
                      {formatMoney(expense.amount, expense.currency)}
                    </strong>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        onClick={() => openEdit(expense)}
                        aria-label="Edit expense"
                      >
                        <Pencil size={14} />
                      </button>
                      {!sourceLocked && (
                        <button
                          type="button"
                          onClick={() => void deleteExpense(expense)}
                          aria-label="Delete expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <WalletCards size={22} />
              <strong>No expenses yet</strong>
              <p>Add the first hotel, flight, meal, ticket, or shopping cost.</p>
              <button type="button" onClick={openNew}>
                <Plus size={14} /> Add an expense
              </button>
            </div>
          )}
        </div>

        <aside className={styles.categoryCard}>
          <h2>Where it goes</h2>
          <div className={styles.categoryRows}>
            {expenseCategories.map(item => {
              const Icon = categoryIcons[item];
              const hasValue = expenses.some(expense => expense.category === item);
              return (
                <div className={styles.categoryRow} key={item}>
                  <div className={styles.categoryLabel}>
                    <Icon size={14} />
                    <span>{expenseCategoryLabels[item]}</span>
                    <strong>{formatCategoryMoney(expenses, item)}</strong>
                  </div>
                  <div className={styles.barTrack}>
                    <span style={{ width: hasValue ? '100%' : '0%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {formOpen && (
        <div className={styles.formBackdrop} role="presentation">
          <form className={styles.form} onSubmit={saveExpense}>
            <div className={styles.formHeader}>
              <div>
                <h2>{editingId ? 'Update expense' : 'Add an expense'}</h2>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Close">
                <X size={17} />
              </button>
            </div>
            <label>
              Expense name
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                autoFocus
                placeholder="Dinner at La Pepica"
                disabled={editingLinkedSource}
              />
            </label>
            <label>
              Link to itinerary{' '}
              <span>{editingLinkedSource ? '(managed by itinerary)' : '(optional)'}</span>
              <select
                value={sourceKey}
                onChange={event => chooseSource(event.target.value)}
                disabled={editingLinkedSource}
              >
                <option value="">Manual expense</option>
                {days.map(day => (
                  <optgroup key={day.id} label={`${day.label}, ${day.shortDate}`}>
                    {sources
                      .filter(source => !source.stayId && !source.flightId)
                      .filter(source => source.date === day.date)
                      .map(source => (
                        <option key={source.key} value={source.key}>
                          {source.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className={styles.formColumns}>
              <label>
                Category
                <select
                  value={category}
                  onChange={event => setCategory(event.target.value as ExpenseCategory)}
                  disabled={editingLinkedSource}
                >
                  {expenseCategories.map(item => (
                    <option key={item} value={item}>
                      {expenseCategoryLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={event => setAmount(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label>
                Currency
                <select
                  value={expenseCurrency}
                  onChange={event => setExpenseCurrency(event.target.value)}
                >
                  {supportedCurrencies.map(option => (
                    <option key={option} value={option}>
                      {option} — {currencyLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Date
              <input
                type="date"
                min={tripStartDate}
                max={tripEndDate}
                value={expenseDate}
                onChange={event => setExpenseDate(event.target.value)}
                disabled={editingLinkedSource}
              />
            </label>
            <label>
              Notes <span>(optional)</span>
              <textarea
                rows={2}
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="Who paid, booking details, or anything else"
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className={styles.saveButton} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add expense'}
              </button>
            </div>
          </form>
        </div>
      )}
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
