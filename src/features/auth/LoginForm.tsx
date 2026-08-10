'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MapPin } from 'lucide-react';
import styles from './LoginForm.module.scss';
import { createClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup';

type LoginFormProps = {
  mode?: AuthMode;
  initialError?: string;
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className={styles.googleMark}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.18-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.46.35 2.84.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33c.71-2.12 2.69-3.7 5.03-3.7Z"
      />
    </svg>
  );
}

export function LoginForm({ mode = 'login', initialError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(initialError ?? '');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  async function signInWithGoogle() {
    setBusy(true);
    setMessage('');

    try {
      const supabase = createClient();
      const redirectUrl = new URL('/auth/callback', window.location.origin);
      redirectUrl.searchParams.set('next', '/editor');

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl.toString() },
      });

      if (error) throw error;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Google sign-in failed. Check your Supabase provider setup.',
      );
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const supabase = createClient();
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/editor');
        router.refresh();
        return;
      }

      const redirectUrl = new URL('/auth/confirm', window.location.origin);
      redirectUrl.searchParams.set('next', '/editor');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl.toString() },
      });

      if (error) throw error;
      if (data.session) {
        router.replace('/editor');
        router.refresh();
        return;
      }
      setMessage('Check your email to confirm your Wayfare account.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Authentication failed. Check your Supabase setup.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <section className={styles.story} aria-label="About Wayfare">
          <div className={styles.storyBadge}>
            <MapPin size={15} aria-hidden="true" /> Your next trip, in one place
          </div>
          <h1>Make space for the good parts.</h1>
          <p>
            Keep the places, plans, and practical details that turn a good idea into a great trip.
          </p>
          <ul>
            <li>
              <Check size={16} aria-hidden="true" /> Save every place worth remembering
            </li>
            <li>
              <Check size={16} aria-hidden="true" /> Shape days that move at your pace
            </li>
            <li>
              <Check size={16} aria-hidden="true" /> Keep the details close when it matters
            </li>
          </ul>
          <div className={styles.routePreview} aria-hidden="true">
            <span className={styles.routeLine} />
            <span className={`${styles.routeStop} ${styles.routeStopFirst}`}>08</span>
            <span className={`${styles.routeStop} ${styles.routeStopSecond}`}>09</span>
            <span className={styles.routePin}>
              <MapPin size={20} />
            </span>
          </div>
        </section>

        <section className={styles.card}>
          <h2>{isLogin ? 'Continue planning.' : 'Start your next trip.'}</h2>
          <p className={styles.intro}>
            {isLogin
              ? 'Your saved places and plans are ready when you are.'
              : 'A quieter, clearer place for every good travel idea.'}
          </p>

          <button
            type="button"
            className={styles.googleButton}
            onClick={signInWithGoogle}
            disabled={busy}
          >
            <GoogleMark />
            {busy ? 'Connecting…' : 'Continue with Google'}
          </button>

          <div className={styles.divider}>
            <span>OR USE EMAIL</span>
          </div>

          <form onSubmit={submit} className={styles.form}>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="At least 6 characters"
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'Working…' : isLogin ? 'Sign in to Wayfare' : 'Create account'}
            </button>
          </form>

          {message && (
            <p
              className={`${styles.message} ${initialError ? styles.messageError : ''}`}
              role="status"
            >
              {message}
            </p>
          )}
          <p className={styles.switchText}>
            {isLogin ? 'No account yet?' : 'Already have an account?'}{' '}
            <Link href={isLogin ? '/signup' : '/login'}>{isLogin ? 'Create one' : 'Sign in'}</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
