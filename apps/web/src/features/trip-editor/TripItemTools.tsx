'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileText,
  Link2,
  Lock,
  Pencil,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import {
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
}: DocumentTarget & { showReservationLock?: boolean }) {
  const trip = useContext(TripItemContext);
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useRef<XMLHttpRequest | null>(null);
  const file = useRef<File | null>(null);
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
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Tickets &amp; links</h3>
          <span className={styles.status}>{linked.length}</span>
        </div>
        <div className={styles.documentList}>
          {linked.map(document => (
            <div className={styles.documentRow} key={document.id}>
              <p>
                {document.storage_path ? <FileText size={13} /> : <Link2 size={13} />}{' '}
                {document.label}
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.buttonQuiet}
                  onClick={() => void open(document)}
                >
                  <Download size={13} /> Open
                </button>
                {trip.access.canEdit && (
                  <>
                    <button
                      type="button"
                      className={styles.buttonQuiet}
                      aria-label={`Rename ${document.label}`}
                      onClick={() => {
                        const next = window.prompt('Document label', document.label);
                        if (next) void write(`${base}/${document.id}`, 'PATCH', { label: next });
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
            </div>
          ))}
          {!linked.length && <p className={styles.hint}>No tickets or links attached yet.</p>}
        </div>
      </div>
      {trip.access.canEdit && (
        <div className={styles.documentForm}>
          <input
            aria-label="Link label"
            placeholder="Link label"
            value={label}
            onChange={event => setLabel(event.target.value)}
          />
          <input
            aria-label="HTTP or HTTPS link"
            placeholder="https://…"
            value={url}
            onChange={event => setUrl(event.target.value)}
          />
          <button
            type="button"
            className={styles.button}
            onClick={() =>
              void write(base, 'POST', { ...target, label, url }).then(saved => {
                if (saved) {
                  setLabel('');
                  setUrl('');
                }
              })
            }
          >
            <Link2 size={13} /> Add link
          </button>
          <label className={styles.fileButton}>
            <Upload size={13} /> Upload PDF or image
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={progress !== null}
              onChange={event => {
                file.current = event.target.files?.[0] ?? null;
                setRetry(Boolean(file.current));
                sendFile();
              }}
            />
          </label>
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
          <label>
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
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
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
