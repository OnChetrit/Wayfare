'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Save, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './UserModal.module.scss';
import type { TripEditorUser, UserPreferences } from './types';

type UserModalProps = {
  open: boolean;
  user: TripEditorUser;
  onClose: () => void;
  onThemeChange: (theme: UserPreferences['theme']) => void;
};

export function UserModal({ open, user, onClose, onThemeChange }: UserModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [preferences, setPreferences] = useState<UserPreferences>(user.preferences);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPreferences(current => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await createClient().auth.updateUser({
      data: { full_name: name.trim() || user.name, preferences },
    });
    if (error) {
      setMessage(error.message);
    } else {
      onThemeChange(preferences.theme);
      onClose();
      router.refresh();
    }
    setBusy(false);
  }

  async function logout() {
    setBusy(true);
    const { error } = await createClient().auth.signOut();
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    onClose();
    router.replace('/login');
    router.refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.userDialog}
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
          <h2>Account & preferences</h2>
        </div>
        <button
          type="button"
          className={styles.dialogClose}
          onClick={onClose}
          aria-label="Close account dialog"
        >
          <X size={17} />
        </button>
      </div>
      <div className={styles.userSummary}>
        <div className={styles.dialogAvatar}>{user.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
      </div>
      <form onSubmit={save}>
        <fieldset className={styles.preferenceGroup} disabled={busy}>
          <legend>Profile</legend>
          <label>
            Display name
            <input value={name} onChange={event => setName(event.target.value)} />
          </label>
        </fieldset>
        <fieldset className={styles.preferenceGroup} disabled={busy}>
          <legend>Preferences</legend>
          <label>
            Currency
            <select
              value={preferences.currency}
              onChange={event => updatePreference('currency', event.target.value)}
            >
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — US Dollar</option>
              <option value="ILS">ILS — Shekel</option>
              <option value="GBP">GBP — Pound</option>
            </select>
          </label>
          <label>
            Appearance
            <select
              value={preferences.theme}
              onChange={event =>
                updatePreference('theme', event.target.value as UserPreferences['theme'])
              }
            >
              <option value="system">Use device setting</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </fieldset>
        {message && (
          <p className={styles.dialogMessage} role="status">
            {message}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button className={styles.savePreferences} type="submit" disabled={busy}>
            <Save size={14} /> {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button className={styles.logoutButton} type="button" onClick={logout} disabled={busy}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </form>
    </dialog>
  );
}
