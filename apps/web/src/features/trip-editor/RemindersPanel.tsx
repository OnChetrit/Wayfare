import { Check, Clock3, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Reminder } from '@wayfare/domain';
import styles from './RemindersPanel.module.scss';

type ReminderFilter = 'OPEN' | 'COMPLETED';

type RemindersPanelProps = {
  open: boolean;
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onReload: (status: ReminderFilter) => void;
  onEdit: (reminder: Reminder) => void;
  onComplete: (reminder: Reminder) => void;
  onReopen: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
};

function dueLabel(reminder: Reminder) {
  const date = new Date(reminder.remindAt);
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
  if (reminder.status === 'OPEN' && date.getTime() < Date.now()) return `Overdue · ${formatted}`;
  return `Due ${formatted}`;
}

export function RemindersPanel({
  open,
  reminders,
  loading,
  error,
  onClose,
  onReload,
  onEdit,
  onComplete,
  onReopen,
  onDelete,
}: RemindersPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<ReminderFilter>('OPEN');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) onReload(filter);
  }, [filter, onReload, open]);

  const visibleReminders = reminders.filter(reminder => reminder.status === filter);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="personal-reminders-heading"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
    >
      <header>
        <div>
          <h2 id="personal-reminders-heading">Personal reminders</h2>
          <p>Only you can see these reminders.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close reminders">
          <X size={17} />
        </button>
      </header>
      <div className={styles.filters} role="tablist" aria-label="Reminder status">
        {(['OPEN', 'COMPLETED'] as const).map(status => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={filter === status}
            className={filter === status ? styles.filterActive : ''}
            onClick={() => setFilter(status)}
          >
            {status === 'OPEN' ? 'Open' : 'Completed'}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {loading ? <p className={styles.state}>Loading reminders…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {!loading && !error && visibleReminders.length === 0 ? (
          <p className={styles.state}>
            {filter === 'OPEN' ? 'No open reminders for this trip.' : 'No completed reminders yet.'}
          </p>
        ) : null}
        {visibleReminders.map(reminder => (
          <article key={reminder.id} className={styles.reminder}>
            <div className={styles.reminderContent}>
              <strong>{reminder.title}</strong>
              {reminder.body ? <p>{reminder.body}</p> : null}
              <span
                className={
                  reminder.status === 'OPEN' && new Date(reminder.remindAt) < new Date()
                    ? styles.overdue
                    : ''
                }
              >
                <Clock3 size={13} /> {dueLabel(reminder)}
              </span>
              <small>
                {reminder.sourceTitle}
                {!reminder.sourceAvailable ? ' · Original note no longer available' : ''}
              </small>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => onEdit(reminder)}
                aria-label={`Edit ${reminder.title}`}
              >
                <Pencil size={14} /> Edit
              </button>
              {reminder.status === 'OPEN' ? (
                <button
                  type="button"
                  onClick={() => onComplete(reminder)}
                  aria-label={`Complete ${reminder.title}`}
                >
                  <Check size={14} /> Complete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onReopen(reminder)}
                  aria-label={`Reopen ${reminder.title}`}
                >
                  <RotateCcw size={14} /> Reopen
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(reminder)}
                aria-label={`Delete ${reminder.title}`}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      <footer className={styles.footer}>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </footer>
    </dialog>
  );
}
