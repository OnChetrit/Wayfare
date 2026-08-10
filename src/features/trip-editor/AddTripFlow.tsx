'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, Compass } from 'lucide-react';
import styles from './AddTripFlow.module.scss';
import type { UserPreferences } from './types';

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDates() {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: dateValue(start), end: dateValue(end) };
}

type AddTripFlowProps = {
  preferences: UserPreferences;
};

export function AddTripFlow({ preferences }: AddTripFlowProps) {
  const router = useRouter();
  const defaults = defaultDates();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (endDate < startDate) {
      setError('Your return date needs to be after your start date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || destination.trim() || 'My next trip',
          destinationLabel: destination.trim() || undefined,
          startDate,
          endDate,
          defaultTimeZone: preferences.timeZone,
          defaultCurrency: preferences.currency,
        }),
      });
      const payload = (await response.json()) as { error?: string; trip?: { id?: string } };
      if (!response.ok) throw new Error(payload.error ?? 'Could not create your trip.');
      if (payload.trip?.id) {
        router.push(`/editor?trip=${encodeURIComponent(payload.trip.id)}`);
      } else {
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your trip.');
      setBusy(false);
    }
  }

  return (
    <section className={styles.addTripPage}>
      <div className={styles.addTripIntro}>
        <div className={styles.addTripIcon}>
          <Compass size={21} />
        </div>
        <h1>Where are you going next?</h1>
        <p>
          Give your trip a name and a little room on the calendar. You can fill in the good parts as
          you go.
        </p>
      </div>
      <form className={styles.addTripCard} onSubmit={submit}>
        <label>
          Trip name
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Summer city break"
            autoFocus
          />
        </label>
        <label>
          Destination
          <input
            value={destination}
            onChange={event => setDestination(event.target.value)}
            placeholder="Lisbon"
            required
          />
        </label>
        <div className={styles.tripDateFields}>
          <label>
            <span>
              <CalendarDays size={13} /> Start date
            </span>
            <input
              className="wayfareDateInput"
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
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
              value={endDate}
              onChange={event => setEndDate(event.target.value)}
              min={startDate}
              required
            />
          </label>
        </div>
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        <button className={styles.createTripButton} type="submit" disabled={busy}>
          {busy ? 'Creating your trip…' : 'Create trip'}
          <ArrowRight size={16} />
        </button>
      </form>
    </section>
  );
}
