import { AmountCurrencyPicker } from '@/components/AmountCurrencyPicker';
import { Clock3, Lock, MapPin, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './ActivityEditor.module.scss';
import { categoryMeta } from './data';
import type { PlaceCategory } from './types';

export type ActivityDraft = {
  name: string;
  category: PlaceCategory;
  startTime: string | null;
  duration: number;
  note: string;
  amount: number | null;
  currency: string;
};

export type ActivityEditorKind = 'activity' | 'arrival' | 'departure';

const manualCategories: PlaceCategory[] = [
  'SHOPPING',
  'RESTAURANT',
  'CAFE',
  'BAR',
  'ATTRACTION',
  'TRANSPORT',
  'CUSTOM',
];

type ActivityEditorProps = {
  tools?: React.ReactNode;
  reservationLocked?: boolean;
  open: boolean;
  dayLabel: string;
  shortDate: string;
  initialTime?: string | null;
  initialName?: string;
  initialDuration?: number;
  initialNote?: string;
  initialAmount?: number | null;
  initialCurrency?: string;
  initialCategory?: PlaceCategory;
  defaultCurrency: string;
  title?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  onClose: () => void;
  onShowPlace?: () => void;
  onSave: (draft: ActivityDraft) => void | Promise<void>;
};

export function ActivityEditor({
  tools,
  reservationLocked = false,
  open,
  dayLabel,
  shortDate,
  initialTime,
  initialName = '',
  initialDuration = 60,
  initialNote = '',
  initialAmount = null,
  initialCurrency,
  initialCategory = 'CUSTOM',
  defaultCurrency,
  title = 'Add an activity',
  nameLabel = 'What are you doing?',
  namePlaceholder = 'Shopping, beach time, laundry…',
  onClose,
  onShowPlace,
  onSave,
}: ActivityEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<PlaceCategory>(initialCategory);
  const [startTime, setStartTime] = useState<string | null>(initialTime ?? null);
  const [duration, setDuration] = useState(String(initialDuration));
  const [note, setNote] = useState(initialNote);
  const [amount, setAmount] = useState(initialAmount == null ? '' : String(initialAmount));
  const [currency, setCurrency] = useState(initialCurrency ?? defaultCurrency);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const durationMinutes = Number(duration);
    const numericAmount = amount.trim() ? Number(amount) : null;
    if (!trimmedName) {
      setError('Give this activity a name.');
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      setError('Duration must be at least 15 minutes.');
      return;
    }
    if (numericAmount !== null && (!Number.isFinite(numericAmount) || numericAmount < 0)) {
      setError('Amount must be zero or greater.');
      return;
    }
    try {
      await onSave({
        name: trimmedName,
        category,
        startTime,
        duration: durationMinutes,
        note: note.trim(),
        amount: numericAmount,
        currency,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save this activity.');
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.editor}
      data-reservation-locked={reservationLocked || undefined}
      aria-labelledby="activity-editor-heading"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className={styles.header}>
          <div>
            <h2 id="activity-editor-heading">{title}</h2>
            <p>
              {dayLabel}, {shortDate}
            </p>
            {reservationLocked ? (
              <span className={styles.lockedBadge}>
                <Lock size={12} /> Reservation locked
              </span>
            ) : null}
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <label>
            {nameLabel}
            <input
              autoFocus
              value={name}
              onChange={event => {
                setName(event.target.value);
                setError('');
              }}
              placeholder={namePlaceholder}
              maxLength={200}
            />
          </label>

          <div className={styles.amountField}>
            <label htmlFor="activity-cost">
              Cost <span className={styles.optional}>(optional)</span>
            </label>
            <div className={styles.amountControls}>
              <input
                id="activity-cost"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <AmountCurrencyPicker value={currency} onChange={setCurrency} />
            </div>
          </div>

          <div className={styles.twoColumns}>
            <label>
              Category
              <select
                value={category}
                onChange={event => setCategory(event.target.value as PlaceCategory)}
              >
                {manualCategories.map(option => (
                  <option key={option} value={option}>
                    {categoryMeta[option].emoji} {categoryMeta[option].label}
                  </option>
                ))}
              </select>
            </label>
            {startTime === null ? (
              <div className={styles.timeControl}>
                <span className={styles.labelWithIcon}>
                  <Clock3 size={12} /> Start time
                </span>
                <button type="button" onClick={() => setStartTime('09:00')}>
                  Add a time
                </button>
              </div>
            ) : (
              <label>
                <span className={styles.labelWithIcon}>
                  <Clock3 size={12} /> Start time
                </span>
                <input
                  type="time"
                  value={startTime}
                  onChange={event => setStartTime(event.target.value || null)}
                />
                <button
                  className={styles.clearTimeButton}
                  type="button"
                  onClick={() => setStartTime(null)}
                >
                  Clear time
                </button>
              </label>
            )}
          </div>

          <label>
            <span className={styles.labelWithIcon}>
              <Timer size={12} /> Duration in minutes
            </span>
            <input
              type="number"
              min="15"
              max="1440"
              step="15"
              value={duration}
              onChange={event => setDuration(event.target.value)}
            />
          </label>

          <label>
            Note <span className={styles.optional}>(optional)</span>
            <textarea
              rows={2}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Anything worth remembering?"
              maxLength={1000}
            />
          </label>

          {tools ? <div className={styles.toolsSlot}>{tools}</div> : null}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>

        <div className={styles.actions}>
          <div className={styles.secondaryActions}>
            {onShowPlace ? (
              <button type="button" className={styles.placeButton} onClick={onShowPlace}>
                <MapPin size={13} /> View place
              </button>
            ) : null}
          </div>
          <div className={styles.saveActions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.saveButton}>
              {title === 'Add an activity' ? 'Add activity' : 'Save activity'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
