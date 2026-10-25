'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Check,
  ExternalLink,
  FileText,
  Link2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import {
  documentLabelSchema,
  documentLinkInputSchema,
  formatMoney,
  paymentStatusLabels,
  type DocumentTarget,
  type TripDocument,
  type TripEditorTrip,
} from '@wayfare/domain';
import { reservationFetch } from '@/lib/reservation-fetch';
import styles from './TripItemTools.module.scss';
export const TripItemContext = createContext<TripEditorTrip | null>(null);
export function TripItemTools({
  kind,
  itemId,
  showReservationLock = true,
  showExistingDocumentPicker = true,
}: DocumentTarget & { showReservationLock?: boolean; showExistingDocumentPicker?: boolean }) {
  const trip = useContext(TripItemContext);
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useRef<XMLHttpRequest | null>(null);
  const file = useRef<File | null>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const item =
    kind === 'ACTIVITY'
      ? trip?.schedule.find(row => row.id === itemId)
      : kind === 'HOTEL'
        ? trip?.stays.find(row => row.id === itemId)
        : kind === 'FLIGHT'
          ? trip?.flights.find(row => row.id === itemId)
          : undefined;
  const [locked, setLocked] = useState(item?.reservationLocked ?? false);
  const base = trip ? `/api/trips/${trip.id}/documents` : '';
  useEffect(() => {
    if (!base) return;
    const controller = new AbortController();
    void fetch(base, { signal: controller.signal })
      .then(response => response.json())
      .then(body => setDocuments(body.documents ?? []))
      .catch(() => {});
    return () => {
      controller.abort();
      upload.current?.abort();
    };
  }, [base]);
  if (!trip) return null;
  const payment = trip.expenses.find(
    expense =>
      expense.coverage?.some(link => link.kind === kind && link.itemId === itemId) ||
      (kind === 'ACTIVITY' && expense.scheduleItemId === itemId) ||
      (kind === 'HOTEL' && expense.stayId === itemId) ||
      (kind === 'FLIGHT' && expense.flightId === itemId),
  );
  const linked = documents.filter(document =>
    document.document_links.some(
      link =>
        (link.kind === kind && link.item_id === itemId) ||
        (payment && link.kind === 'EXPENSE' && link.item_id === payment.id),
    ),
  );
  const target = { kind, itemId };
  async function refresh() {
    const response = await fetch(base);
    const body = await response.json();
    setDocuments(body.documents ?? []);
  }
  async function write(path: string, method: string, body: unknown) {
    setError('');
    try {
      const response = await reservationFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    }
  }
  async function open(document: TripDocument) {
    try {
      const response = await fetch(`${base}/${document.id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.open(body.url, '_blank', 'noopener,noreferrer');
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  function sendFile() {
    if (!file.current) return;
    const form = new FormData();
    form.set('file', file.current);
    form.set('kind', kind);
    form.set('itemId', itemId);
    const xhr = new XMLHttpRequest();
    upload.current = xhr;
    setProgress(0);
    setError('');
    xhr.open('POST', base);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        file.current = null;
        setRetry(false);
        void refresh();
      } else {
        try {
          setError(JSON.parse(xhr.responseText).error);
        } catch {
          setError('Upload failed. Retry when connected.');
        }
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError('Upload failed. Retry when connected.');
    };
    xhr.onabort = () => {
      setProgress(null);
      setError('Upload cancelled. You can retry.');
    };
    xhr.send(form);
  }
  function saveRename(documentId: string) {
    const parsed = documentLabelSchema.safeParse(renameLabel);
    if (!parsed.success) {
      setError('Give this attachment a name.');
      return;
    }
    void write(`${base}/${documentId}`, 'PATCH', { label: parsed.data }).then(saved => {
      if (saved) setRenamingId(null);
    });
  }
  function saveLink() {
    const parsed = documentLinkInputSchema.safeParse({
      ...target,
      label: label.trim(),
      url: url.trim(),
    });
    if (!parsed.success) {
      setError('Add a name and an HTTP or HTTPS link.');
      return;
    }
    void write(base, 'POST', parsed.data).then(saved => {
      if (saved) {
        setLabel('');
        setUrl('');
        setLinkFormOpen(false);
      }
    });
  }
  return (
    <section className={styles.tools} aria-label="Reservation, payment and documents">
      {item && showReservationLock && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <strong>Reservation</strong>
            <span
              className={`${styles.status} ${locked ? styles.statusLocked : ''}`}
              aria-label={locked ? 'Reservation locked' : 'Reservation unlocked'}
            >
              {locked ? <Lock size={13} /> : <Unlock size={13} />}
              {locked ? 'Locked' : 'Unlocked'}
            </span>
          </div>
          {trip.access.canEdit && (
            <button
              type="button"
              className={styles.buttonQuiet}
              onClick={() =>
                void write(`/api/trips/${trip.id}/reservations/${kind}/${itemId}`, 'PATCH', {
                  locked: !locked,
                }).then(saved => {
                  if (saved) setLocked(!locked);
                })
              }
            >
              {locked ? 'Unlock reservation' : 'Lock reservation'}
            </button>
          )}
        </div>
      )}
      {payment ? (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <strong>Payment</strong>
            <span className={styles.status}>
              {payment.paymentStatus === 'PAID' ? <Check size={13} /> : null}
              {paymentStatusLabels[payment.paymentStatus ?? 'NEEDS_REVIEW']}
            </span>
          </div>
          <details>
            <summary>{payment.title}</summary>
            <p>
              {formatMoney(payment.amount, payment.currency)}
              {(payment.coverage?.length ?? 0) > 1 && ' · Covered by shared payment'}
            </p>
            {payment.coverage?.map((link, index) => (
              <p key={`${link.kind}:${link.itemId ?? index}`}>
                {link.title} · {link.date}
                {link.allocatedAmount != null &&
                  ` · ${formatMoney(link.allocatedAmount, payment.currency)}`}
              </p>
            ))}
          </details>
        </div>
      ) : (
        item && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <strong>Payment</strong>
              <span className={styles.status}>Unpaid</span>
            </div>
            <p>No payment recorded</p>
          </div>
        )
      )}
      <div className={styles.documentSection}>
        <div className={styles.documentHeader}>
          <div className={styles.documentHeading}>
            <span className={styles.documentHeadingIcon} aria-hidden="true">
              <FileText size={17} />
            </span>
            <div>
              <h3>Tickets &amp; links</h3>
              <p>Keep booking files and useful links together.</p>
            </div>
          </div>
          <span className={styles.documentCount} aria-label={`${linked.length} attachments`}>
            {linked.length}
          </span>
        </div>
        <div className={styles.documentList}>
          {linked.map(document => (
            <div className={styles.documentRow} key={document.id}>
              <span className={styles.documentIcon} aria-hidden="true">
                {document.storage_path ? <FileText size={16} /> : <Link2 size={16} />}
              </span>
              {renamingId === document.id ? (
                <div className={styles.renameField}>
                  <input
                    autoFocus
                    aria-label={`New name for ${document.label}`}
                    value={renameLabel}
                    maxLength={200}
                    onChange={event => {
                      setRenameLabel(event.target.value);
                      setError('');
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Escape') setRenamingId(null);
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        saveRename(document.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => saveRename(document.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={styles.buttonQuiet}
                    aria-label="Cancel rename"
                    onClick={() => setRenamingId(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className={styles.documentInfo}>
                  <strong title={document.label}>{document.label}</strong>
                  <span>{document.storage_path ? 'File' : 'Link'}</span>
                </div>
              )}
              {renamingId !== document.id && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.buttonQuiet}
                    onClick={() => void open(document)}
                  >
                    <ExternalLink size={13} /> Open
                  </button>
                  {trip.access.canEdit && (
                    <>
                      <button
                        type="button"
                        className={styles.buttonQuiet}
                        aria-label={`Rename ${document.label}`}
                        onClick={() => {
                          setError('');
                          setRenameLabel(document.label);
                          setRenamingId(document.id);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className={styles.buttonDanger}
                        aria-label={`Remove ${document.label}`}
                        disabled={
                          !document.document_links.some(
                            link => link.kind === kind && link.item_id === itemId,
                          )
                        }
                        title={
                          document.document_links.some(
                            link => link.kind === kind && link.item_id === itemId,
                          )
                            ? 'Remove from this item'
                            : 'This attachment belongs to a linked payment'
                        }
                        onClick={() => {
                          if (
                            window.confirm(
                              'Remove this attachment from this item? Other references keep their copy. The stored file is deleted only when no references remain.',
                            )
                          )
                            void write(`${base}/${document.id}`, 'DELETE', target);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {!linked.length && (
            <div className={styles.emptyDocuments}>
              <FileText size={20} aria-hidden="true" />
              <p>No tickets or links attached yet.</p>
            </div>
          )}
        </div>
        {trip.access.canEdit && (
          <div className={styles.documentComposer}>
            <div className={styles.addActions}>
              <button
                type="button"
                className={styles.addLinkButton}
                aria-expanded={linkFormOpen}
                onClick={() => {
                  setError('');
                  setLinkFormOpen(current => !current);
                }}
              >
                <Plus size={15} /> Add link
              </button>
              <button
                type="button"
                className={styles.uploadButton}
                disabled={progress !== null}
                onClick={() => filePicker.current?.click()}
              >
                <Upload size={15} /> Upload file
              </button>
              <input
                ref={filePicker}
                className={styles.fileInput}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={progress !== null}
                aria-label="Upload PDF or image"
                onChange={event => {
                  file.current = event.target.files?.[0] ?? null;
                  setRetry(Boolean(file.current));
                  sendFile();
                  event.target.value = '';
                }}
              />
            </div>
            {linkFormOpen && (
              <div
                className={styles.linkForm}
                onKeyDown={event => {
                  if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                    event.preventDefault();
                    saveLink();
                  }
                }}
              >
                <label>
                  Link name
                  <input
                    autoFocus
                    placeholder="Booking confirmation"
                    value={label}
                    maxLength={200}
                    onChange={event => {
                      setLabel(event.target.value);
                      setError('');
                    }}
                  />
                </label>
                <label>
                  Web address
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={event => {
                      setUrl(event.target.value);
                      setError('');
                    }}
                  />
                </label>
                <div className={styles.linkFormActions}>
                  <button
                    type="button"
                    className={styles.buttonQuiet}
                    onClick={() => setLinkFormOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    onClick={saveLink}
                  >
                    Save link
                  </button>
                </div>
              </div>
            )}
            <small className={styles.hint}>PDF, JPEG, PNG, or WebP · 20 MB maximum</small>
            {progress !== null && (
              <div className={styles.progress}>
                <progress max={100} value={progress} aria-label="Upload progress" />
                <button
                  type="button"
                  className={styles.buttonQuiet}
                  onClick={() => upload.current?.abort()}
                >
                  Cancel upload
                </button>
              </div>
            )}
            {retry && progress === null && (
              <button type="button" className={styles.buttonQuiet} onClick={sendFile}>
                Retry upload
              </button>
            )}
            {showExistingDocumentPicker && (
              <label className={styles.existingDocument}>
                Use existing trip document
                <select
                  value=""
                  onChange={event => {
                    if (event.target.value)
                      void write(base, 'POST', { ...target, documentId: event.target.value });
                  }}
                >
                  <option value="">Choose a document</option>
                  {documents
                    .filter(document => !linked.includes(document))
                    .map(document => (
                      <option key={document.id} value={document.id}>
                        {document.label}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
export function ItemIndicators({
  kind,
  itemId,
  showReservationLock = true,
}: DocumentTarget & { showReservationLock?: boolean }) {
  const trip = useContext(TripItemContext);
  if (!trip) return null;
  const item =
    kind === 'ACTIVITY'
      ? trip.schedule.find(row => row.id === itemId)
      : kind === 'HOTEL'
        ? trip.stays.find(row => row.id === itemId)
        : trip.flights.find(row => row.id === itemId);
  const paid = trip.expenses.some(
    row =>
      row.paymentStatus === 'PAID' &&
      (row.coverage?.some(link => link.kind === kind && link.itemId === itemId) ||
        row.stayId === itemId ||
        row.flightId === itemId ||
        row.scheduleItemId === itemId),
  );
  const locked = showReservationLock && item?.reservationLocked;
  if (!locked && !paid) return null;

  return (
    <span className={styles.indicators}>
      {locked ? (
        <span
          className={styles.lockIndicator}
          aria-label="Reservation locked"
          title="Reservation locked"
        >
          <Lock size={13} />
        </span>
      ) : null}
      {paid ? (
        <span className={styles.paidIndicator} aria-label="Paid" title="Paid">
          <Check size={13} />
        </span>
      ) : null}
    </span>
  );
}
