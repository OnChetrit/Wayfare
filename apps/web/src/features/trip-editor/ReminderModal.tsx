import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Reminder, ReminderSourceKind } from '@wayfare/domain';
import styles from './ReminderModal.module.scss';

export type ReminderSourceDraft = {
  sourceKind: ReminderSourceKind;
  savedPlaceId: string | null;
  scheduleItemId: string | null;
  sourceTitle: string;
  sourceBody: string;
};

export type ReminderFormDraft = {
  title: string;
  body: string;
  remindAt: string;
};

function localDateTimeValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultReminderTime() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return localDateTimeValue(date.toISOString());
}

type ReminderModalProps = {
  open: boolean;
  reminder?: Reminder;
  source?: ReminderSourceDraft;
  isOnline: boolean;
  onClose: () => void;
  onSave: (draft: ReminderFormDraft) => Promise<void>;
};

export function ReminderModal({
  open,
  reminder,
  source,
  isOnline,
  onClose,
  onSave,
}: ReminderModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(() => reminder?.title ?? source?.sourceTitle ?? '');
  const [body, setBody] = useState(() => reminder?.body ?? source?.sourceBody ?? '');
  const [remindAt, setRemindAt] = useState(() =>
    reminder ? localDateTimeValue(reminder.remindAt) : defaultReminderTime(),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setError('Reconnect to create or edit a reminder. Reminder drafts are not saved offline.');
      return;
    }
    if (!title.trim()) {
      setError('Give this reminder a title.');
      return;
    }
    const date = new Date(remindAt);
    if (!remindAt || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      setError('Choose a reminder time in the future.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), body: body.trim(), remindAt: date.toISOString() });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this reminder.');
    } finally {
      setSaving(false);
    }
  }

  const isEditing = Boolean(reminder);
  const contextTitle = reminder?.sourceTitle ?? source?.sourceTitle;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="reminder-editor-heading"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
    >
      <form onSubmit={event => void submit(event)}>
        <header>
          <div>
            <h2 id="reminder-editor-heading">{isEditing ? 'Edit reminder' : 'Create reminder'}</h2>
            {contextTitle ? <p>From {contextTitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close reminder editor">
            <X size={16} />
          </button>
        </header>

        <div className={styles.body}>
          {!isOnline ? (
            <p className={styles.offline} role="status">
              You’re offline. Reconnect before saving; reminders are never queued locally.
            </p>
          ) : null}

          <label>
            Title
            <input
              autoFocus
              value={title}
              maxLength={200}
              onChange={event => setTitle(event.target.value)}
            />
          </label>
          <label>
            Reminder note
            <textarea
              value={body}
              rows={5}
              maxLength={5000}
              onChange={event => setBody(event.target.value)}
            />
          </label>
          <label>
            Remind me at
            <input
              type="datetime-local"
              value={remindAt}
              onChange={event => setRemindAt(event.target.value)}
            />
          </label>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!isOnline || saving}>
            {saving ? 'Saving…' : isEditing ? 'Save reminder' : 'Create reminder'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
