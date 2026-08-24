'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { CalendarDays, Plane, Plus, Save, Search, Trash2, X } from 'lucide-react';
import styles from './TripSettingsModal.module.scss';
import { expenseFromDatabase } from '@/lib/trips/expenses';
import { flightDate, flightFromDatabase, flightTime } from '@/lib/trips/flights';
import type { Expense, TripDay, TripEditorTrip, TripFlight } from './types';
import type { TripFlightCandidate } from '@/lib/trips/flights';

type SavedTripSettings = Pick<
  TripEditorTrip,
  'name' | 'startDate' | 'endDate' | 'destinationLabel' | 'defaultTimeZone' | 'defaultCurrency'
> & { days: TripDay[] };

type TripSettingsModalProps = {
  open: boolean;
  trip: TripEditorTrip;
  initialFlightDate?: string;
  focusFlights?: boolean;
  onClose: () => void;
  onSaved: (trip: SavedTripSettings) => void;
  onDeleted: () => void;
  onFlightsChange: (flights: TripFlight[]) => void;
  onExpensesChange: (expenses: Expense[]) => void;
};

type TripSettingsForm = {
  name: string;
  destinationLabel: string;
  startDate: string;
  endDate: string;
  defaultCurrency: string;
};

function formFromTrip(trip: TripEditorTrip): TripSettingsForm {
  return {
    name: trip.name,
    destinationLabel: trip.destinationLabel ?? '',
    startDate: trip.startDate,
    endDate: trip.endDate,
    defaultCurrency: trip.defaultCurrency,
  };
}

export function TripSettingsModal({
  open,
  trip,
  initialFlightDate,
  focusFlights = false,
  onClose,
  onSaved,
  onDeleted,
  onFlightsChange,
  onExpensesChange,
}: TripSettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(() => formFromTrip(trip));
  const [flights, setFlights] = useState<TripFlight[]>(trip.flights);
  const [expenses, setExpenses] = useState<Expense[]>(trip.expenses);
  const [flightNumber, setFlightNumber] = useState('');
  const [flightDateInput, setFlightDateInput] = useState(initialFlightDate ?? trip.startDate);
  const [flightResults, setFlightResults] = useState<TripFlightCandidate[]>([]);
  const [flightSearchBusy, setFlightSearchBusy] = useState(false);
  const [flightActionId, setFlightActionId] = useState<string | null>(null);
  const [flightError, setFlightError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function update<K extends keyof TripSettingsForm>(key: K, value: TripSettingsForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function searchFlights() {
    if (!flightNumber.trim()) {
      setFlightError('Enter a flight number, such as LY315.');
      return;
    }
    setFlightSearchBusy(true);
    setFlightError('');
    setFlightResults([]);
    try {
      const response = await fetch(`/api/trips/${trip.id}/flights/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flightNumber, departureDate: flightDateInput }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        flights?: TripFlightCandidate[];
      };
      if (!response.ok) throw new Error(formatError(payload.error));
      if (!payload.flights?.length) {
        setFlightError('No flights were found for that number and date.');
        return;
      }
      setFlightResults(payload.flights);
    } catch (caught) {
      setFlightError(
        caught instanceof Error ? caught.message : 'Could not search for that flight.',
      );
    } finally {
      setFlightSearchBusy(false);
    }
  }

  async function addFlight(candidate: TripFlightCandidate) {
    setFlightActionId(`add-${candidate.flightNumber}-${candidate.scheduledDepartureUtc}`);
    setFlightError('');
    try {
      const response = await fetch(`/api/trips/${trip.id}/flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        flight?: Parameters<typeof flightFromDatabase>[0];
        expense?: Parameters<typeof expenseFromDatabase>[0] | null;
      };
      if (!response.ok) throw new Error(formatError(payload.error));
      if (!payload.flight)
        throw new Error('The flight was added, but no flight data was returned.');
      const added = flightFromDatabase(payload.flight);
      const nextFlights = [...flights, added].sort((a, b) =>
        `${a.departureDate}T${a.scheduledDepartureUtc}`.localeCompare(
          `${b.departureDate}T${b.scheduledDepartureUtc}`,
        ),
      );
      setFlights(nextFlights);
      onFlightsChange(nextFlights);
      if (payload.expense) {
        const nextExpenses = [...expenses, expenseFromDatabase(payload.expense)];
        setExpenses(nextExpenses);
        onExpensesChange(nextExpenses);
      }
    } catch (caught) {
      setFlightError(caught instanceof Error ? caught.message : 'Could not add that flight.');
    } finally {
      setFlightActionId(null);
    }
  }

  async function removeFlight(flightId: string) {
    setFlightActionId(`remove-${flightId}`);
    setFlightError('');
    try {
      const response = await fetch(`/api/trips/${trip.id}/flights/${flightId}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
      if (!response.ok) throw new Error(formatError(payload.error));
      const nextFlights = flights.filter(flight => flight.id !== flightId);
      setFlights(nextFlights);
      onFlightsChange(nextFlights);
      const nextExpenses = expenses.filter(expense => expense.flightId !== flightId);
      setExpenses(nextExpenses);
      onExpensesChange(nextExpenses);
    } catch (caught) {
      setFlightError(caught instanceof Error ? caught.message : 'Could not remove that flight.');
    } finally {
      setFlightActionId(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.endDate < form.startDate) {
      setError('Your return date needs to be after your start date.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          destinationLabel: form.destinationLabel.trim() || null,
          defaultTimeZone: trip.defaultTimeZone,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        trip?: SavedTripSettings;
      };
      if (!response.ok) {
        throw new Error(formatError(payload.error));
      }
      if (!payload.trip)
        throw new Error('The trip was saved, but the updated trip was not returned.');
      onSaved(payload.trip);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save trip settings.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteTrip() {
    const confirmed = window.confirm(
      `Delete ${trip.name}? This permanently removes its itinerary, places, stays, flights, and expenses.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
      if (!response.ok) throw new Error(formatError(payload.error));
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this trip.');
      setDeleting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.settingsDialog}
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className={styles.dialogHeader}>
        <div>
          <h2>Trip settings</h2>
        </div>
        <button
          type="button"
          className={styles.dialogClose}
          onClick={onClose}
          aria-label="Close trip settings"
        >
          <X size={17} />
        </button>
      </div>

      <form onSubmit={save}>
        <fieldset className={styles.settingsGroup} disabled={busy || deleting}>
          <legend>Trip details</legend>
          <label>
            Trip name
            <input
              value={form.name}
              onChange={event => update('name', event.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label>
            Destination
            <input
              value={form.destinationLabel}
              onChange={event => update('destinationLabel', event.target.value)}
              placeholder="Lisbon"
              maxLength={120}
            />
          </label>
          <div className={styles.dateFields}>
            <label>
              <span>
                <CalendarDays size={13} /> Start date
              </span>
              <input
                className="wayfareDateInput"
                type="date"
                value={form.startDate}
                onChange={event => update('startDate', event.target.value)}
                required
              />
            </label>
            <label>
              <span>
                <CalendarDays size={13} /> End date
              </span>
              <input
                className="wayfareDateInput"
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={event => update('endDate', event.target.value)}
                required
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.settingsGroup} disabled={busy || deleting}>
          <legend>Trip defaults</legend>
          <label>
            Currency
            <select
              value={form.defaultCurrency}
              onChange={event => update('defaultCurrency', event.target.value)}
            >
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — US Dollar</option>
              <option value="ILS">ILS — Shekel</option>
              <option value="GBP">GBP — Pound</option>
            </select>
          </label>
        </fieldset>

        <fieldset
          className={`${styles.settingsGroup} ${styles.flightGroup}`}
          disabled={busy || deleting || flightSearchBusy || flightActionId !== null}
        >
          <legend>
            <Plane size={12} /> Flights
          </legend>
          <p className={styles.groupHint}>
            Add flights to this trip. They appear automatically in the daily plan and can only be
            removed here.
          </p>
          <div className={styles.flightSearchFields}>
            <label>
              Flight number
              <input
                value={flightNumber}
                onChange={event => setFlightNumber(event.target.value.toUpperCase())}
                placeholder="LY315"
                maxLength={20}
                autoComplete="off"
                autoFocus={focusFlights}
              />
            </label>
            <label>
              Flight date
              <input
                className="wayfareDateInput"
                type="date"
                value={flightDateInput}
                min={trip.startDate}
                max={trip.endDate}
                onChange={event => setFlightDateInput(event.target.value)}
              />
            </label>
          </div>
          <button type="button" className={styles.flightSearchButton} onClick={searchFlights}>
            <Search size={14} /> {flightSearchBusy ? 'Searching…' : 'Search flight'}
          </button>

          {flightResults.length > 0 && (
            <div className={styles.flightResults}>
              <span className={styles.resultsLabel}>SEARCH RESULTS</span>
              {flightResults.map(candidate => {
                const candidateKey = `add-${candidate.flightNumber}-${candidate.scheduledDepartureUtc}`;
                const alreadyAdded = flights.some(
                  flight =>
                    flight.flightNumber === candidate.flightNumber &&
                    flight.scheduledDepartureUtc === candidate.scheduledDepartureUtc,
                );
                return (
                  <div className={styles.flightResult} key={candidateKey}>
                    <div>
                      <strong>{candidate.flightNumber}</strong>
                      <span>
                        {candidate.departureAirportIata ?? '—'} →{' '}
                        {candidate.arrivalAirportIata ?? '—'} ·{' '}
                        {flightTime(candidate.scheduledDepartureLocal)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.addFlightButton}
                      onClick={() => addFlight(candidate)}
                      disabled={alreadyAdded || flightActionId !== null}
                    >
                      {alreadyAdded ? (
                        'Added'
                      ) : flightActionId === candidateKey ? (
                        'Adding…'
                      ) : (
                        <>
                          <Plus size={13} /> Add
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {flights.length > 0 && (
            <div className={styles.savedFlights}>
              <span className={styles.resultsLabel}>TRIP FLIGHTS · {flights.length}</span>
              {flights.map(flight => (
                <div className={styles.savedFlight} key={flight.id}>
                  <div className={styles.savedFlightIcon}>
                    <Plane size={14} />
                  </div>
                  <div className={styles.savedFlightDetails}>
                    <strong>{flight.flightNumber}</strong>
                    <span>
                      {flight.departureAirportIata ?? '—'} → {flight.arrivalAirportIata ?? '—'} ·{' '}
                      {flightDate(flight.scheduledDepartureLocal)} at{' '}
                      {flightTime(flight.scheduledDepartureLocal)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.removeFlightButton}
                    onClick={() => removeFlight(flight.id)}
                    aria-label={`Remove flight ${flight.flightNumber}`}
                    disabled={flightActionId !== null}
                  >
                    {flightActionId === `remove-${flight.id}` ? '…' : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
          {flightError && (
            <p className={styles.flightError} role="alert">
              {flightError}
            </p>
          )}
        </fieldset>

        {error && (
          <p className={styles.dialogError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button className={styles.saveButton} type="submit" disabled={busy || deleting}>
            <Save size={14} /> {busy ? 'Saving…' : 'Save settings'}
          </button>
          <button
            className={styles.cancelButton}
            type="button"
            onClick={onClose}
            disabled={busy || deleting}
          >
            Cancel
          </button>
        </div>
        <section className={styles.dangerZone} aria-labelledby="delete-trip-heading">
          <div>
            <h3 id="delete-trip-heading">Delete trip</h3>
            <p>Permanently remove this trip and all of its plans.</p>
          </div>
          <button type="button" onClick={deleteTrip} disabled={busy || deleting}>
            <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete trip'}
          </button>
        </section>
      </form>
    </dialog>
  );
}

function formatError(error: unknown) {
  if (typeof error === 'string' && error.trim()) return error;
  if (!error || typeof error !== 'object') return 'Could not save trip settings.';
  const payload = error as { message?: unknown; formErrors?: unknown; fieldErrors?: unknown };
  const messages: string[] = [];
  if (typeof payload.message === 'string') messages.push(payload.message);
  if (Array.isArray(payload.formErrors)) {
    messages.push(
      ...payload.formErrors.filter((value): value is string => typeof value === 'string'),
    );
  }
  if (payload.fieldErrors && typeof payload.fieldErrors === 'object') {
    Object.values(payload.fieldErrors).forEach(value => {
      if (Array.isArray(value))
        messages.push(...value.filter((item): item is string => typeof item === 'string'));
    });
  }
  return messages.join(' ') || 'Could not save trip settings.';
}
