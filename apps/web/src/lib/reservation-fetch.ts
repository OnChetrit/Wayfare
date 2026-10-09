import {
  reservationConfirmation,
  reservationAcknowledgements,
  reservationChangeSummary,
} from '@wayfare/domain';
/** Replays the exact proposed write only after reviewing the server's versioned reservation change. */
export async function reservationFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await globalThis.fetch(input, init);
  if (response.ok || !init?.method || init.method === 'GET') return response;
  const parsed = reservationConfirmation(
    await response
      .clone()
      .json()
      .catch(() => null),
  );
  if (!parsed.success) return response;
  const change = parsed.data;
  if (
    !window.confirm(
      `Reservation locked\n${reservationChangeSummary(change)}\n\n${init.method === 'DELETE' ? 'Delete reservation' : 'Save changes'}?`,
    )
  )
    throw new Error('Change cancelled. Your draft has been kept.');
  const headers = new Headers(init.headers);
  headers.set('x-reservation-confirmations', JSON.stringify(reservationAcknowledgements(change)));
  return globalThis.fetch(input, { ...init, headers });
}
