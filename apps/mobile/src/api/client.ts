import { Alert } from 'react-native';
import {
  reservationConfirmation,
  reservationAcknowledgements,
  reservationChangeSummary,
} from '@wayfare/domain';
import { clearLocalSession, supabase } from '@/lib/supabase';
import { apiErrorMessage, WayfareApiError } from '@/api/error';

const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');

async function hasInvalidSupabaseSession(accessToken: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    return Boolean(error || !user);
  } catch {
    // A connectivity failure while checking Supabase must not erase the
    // session that is safely stored on this device.
    return false;
  }
}

export async function requestWayfareApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!webUrl) {
    throw new WayfareApiError('Wayfare is not configured. Add EXPO_PUBLIC_WEB_URL to the app env.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    await clearLocalSession();
    throw new WayfareApiError(
      'Your session has ended. Please sign in again.',
      401,
      'SESSION_INVALID',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${webUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new WayfareApiError(
      'Could not reach Wayfare. Check your connection and try again.',
      0,
      'NETWORK',
    );
  }

  const payload = await response.json().catch(() => null);
  if (response.status === 401) {
    // A 401 from the Wayfare API can also mean the deployed API is misconfigured
    // or temporarily unable to validate a token. Only remove this device's
    // session after Supabase itself confirms that the token is invalid.
    const sessionIsInvalid = await hasInvalidSupabaseSession(session.access_token);
    if (sessionIsInvalid) await clearLocalSession();
    throw new WayfareApiError(
      'Your session could not be verified. Please sign in again.',
      401,
      sessionIsInvalid ? 'SESSION_INVALID' : 'AUTH',
    );
  }

  if (!response.ok && !new Headers(init.headers).has('x-reservation-confirmations')) {
    const parsed = reservationConfirmation(payload);
    if (parsed.success) {
      const change = parsed.data;
      const accepted = await new Promise<boolean>(resolve =>
        Alert.alert(
          `${change.title} · Reservation locked`,
          reservationChangeSummary(change),
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: init.method === 'DELETE' ? 'Delete reservation' : 'Save changes',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: false },
        ),
      );
      if (!accepted) throw new WayfareApiError('Change cancelled. Your draft has been kept.');
      return requestWayfareApi<T>(path, {
        ...init,
        headers: {
          ...init.headers,
          'x-reservation-confirmations': JSON.stringify(reservationAcknowledgements(change)),
        },
      });
    }
  }
  if (!response.ok) {
    throw new WayfareApiError(
      apiErrorMessage(payload, 'Could not complete that request.'),
      response.status,
      typeof payload === 'object' && payload ? (payload as { code?: string }).code : undefined,
    );
  }

  return payload as T;
}

export type RevisionRequest = { revision?: number };

export function withTripRevision(init: RequestInit, revision?: number): RequestInit {
  if (revision === undefined) return init;
  return {
    ...init,
    headers: { ...init.headers, 'If-Match': String(revision) },
  };
}
