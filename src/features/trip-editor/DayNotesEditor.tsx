import { FileText, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './DayNotesEditor.module.scss';

type DayNotesEditorProps = {
  open: boolean;
  dayLabel: string;
  shortDate: string;
  initialNotes: string;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
};

export function DayNotesEditor({
  open,
  dayLabel,
  shortDate,
  initialNotes,
  onClose,
  onSave,
}: DayNotesEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onClose();
    void onSave(notes.trim()).catch(() => {
      // The save handler restores the optimistic state and displays the error.
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.editor}
      aria-labelledby="day-notes-editor-heading"
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
            <h2 id="day-notes-editor-heading">Day notes</h2>
            <p>
              {dayLabel}, {shortDate}
            </p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <label>
          <span className={styles.labelWithIcon}>
            <FileText size={12} /> Notes for this day
          </span>
          <textarea
            autoFocus
            rows={7}
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="Ideas, reminders, opening hours, or anything else worth remembering…"
            maxLength={5000}
          />
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.saveButton}>
            Save notes
          </button>
        </div>
      </form>
    </dialog>
  );
}
