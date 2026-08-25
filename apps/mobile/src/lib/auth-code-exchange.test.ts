import { describe, expect, it, vi } from 'vitest';

import { shareAuthCodeExchange } from './auth-code-exchange';

describe('shareAuthCodeExchange', () => {
  it('makes concurrent deep-link handlers await the same exchange', async () => {
    let finishExchange: (value: Error | null) => void = () => undefined;
    const exchange = vi.fn(
      () =>
        new Promise<Error | null>(resolve => {
          finishExchange = resolve;
        }),
    );
    const exchanges = new Map<string, Promise<Error | null>>();

    const first = shareAuthCodeExchange('one-time-code', exchanges, exchange);
    const second = shareAuthCodeExchange('one-time-code', exchanges, exchange);

    expect(exchange).toHaveBeenCalledOnce();
    expect(second).toBe(first);

    finishExchange(null);
    await expect(second).resolves.toBeNull();
  });

  it('allows a retry when the exchange fails', async () => {
    const exchanges = new Map<string, Promise<Error | null>>();
    const failedExchange = shareAuthCodeExchange(
      'retry-code',
      exchanges,
      async () => new Error('PKCE verifier missing'),
    );

    await expect(failedExchange).resolves.toEqual(new Error('PKCE verifier missing'));
    await Promise.resolve();

    const retry = shareAuthCodeExchange('retry-code', exchanges, async () => null);
    await expect(retry).resolves.toBeNull();
  });
});
