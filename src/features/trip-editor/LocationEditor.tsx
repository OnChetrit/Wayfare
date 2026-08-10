import { useLayoutEffect, useRef, type FormEvent } from 'react';
import { X } from 'lucide-react';
import styles from './LocationEditor.module.scss';
import type { LocationEditorState } from './date-bar-types';

type LocationEditorProps = {
  editor: LocationEditorState;
  selectionSummary?: string;
  onChange: (next: Partial<LocationEditorState>) => void;
  onChangeDraft: (next: Partial<LocationEditorState['draft']>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

export function LocationEditor({
  editor,
  selectionSummary,
  onChange,
  onChangeDraft,
  onClose,
  onSave,
  onDelete,
}: LocationEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  const isRange = editor.mode === 'add' && editor.rangeStart && editor.rangeEnd;
  const hasValidDates =
    editor.mode !== 'edit' ||
    Boolean(
      editor.draft.startDate &&
      editor.draft.endDate &&
      editor.draft.startDate < editor.draft.endDate,
    );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.timelineEditor}
      aria-label="Location editor"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className={styles.timelineEditorHeader}>
          <strong>{editor.mode === 'add' ? 'Add location division' : 'Edit location'}</strong>
          <button
            type="button"
            className={styles.editorIconButton}
            onClick={onClose}
            aria-label="Close location editor"
          >
            <X size={14} />
          </button>
        </div>
        {isRange ? (
          <div className={styles.timelineSelectionSummary}>{selectionSummary}</div>
        ) : editor.mode === 'add' ? (
          <label>
            Split after date
            <input
              className="wayfareDateInput"
              type="date"
              value={editor.splitDate}
              onChange={event => onChange({ splitDate: event.target.value })}
            />
          </label>
        ) : null}
        <label>
          Location name *
          <input
            autoFocus
            required
            value={editor.draft.locationName}
            onChange={event => onChangeDraft({ locationName: event.target.value })}
          />
        </label>
        {editor.mode === 'edit' && (
          <div className={styles.editorTwoColumns}>
            <label>
              Start date
              <input
                className="wayfareDateInput"
                type="date"
                required
                value={editor.draft.startDate ?? ''}
                onChange={event => onChangeDraft({ startDate: event.target.value })}
              />
            </label>
            <label>
              End date
              <input
                className="wayfareDateInput"
                type="date"
                required
                value={editor.draft.endDate ?? ''}
                onChange={event => onChangeDraft({ endDate: event.target.value })}
              />
            </label>
          </div>
        )}
        <div className={styles.timelineEditorActions}>
          {onDelete && (
            <button type="button" className={styles.editorDeleteButton} onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="button" className={styles.editorCancelButton} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.editorSaveButton} disabled={!hasValidDates}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
