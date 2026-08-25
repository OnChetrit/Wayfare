export type ApiErrorPayload = {
  error?: string | { message?: string };
  code?: string;
};

export class WayfareApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'WayfareApiError';
  }
}

export function apiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const { error } = payload as ApiErrorPayload;
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  return fallback;
}

export function isAuthenticationError(error: unknown) {
  return error instanceof WayfareApiError && error.status === 401;
}

export function isSessionInvalidError(error: unknown) {
  return error instanceof WayfareApiError && error.code === 'SESSION_INVALID';
}
