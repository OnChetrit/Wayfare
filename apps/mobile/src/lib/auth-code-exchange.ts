export function shareAuthCodeExchange(
  code: string,
  exchanges: Map<string, Promise<Error | null>>,
  exchange: () => Promise<Error | null>,
) {
  const inFlightExchange = exchanges.get(code);
  if (inFlightExchange) return inFlightExchange;

  const pendingExchange = exchange();
  exchanges.set(code, pendingExchange);

  void pendingExchange.then(
    error => {
      if (error) exchanges.delete(code);
    },
    () => exchanges.delete(code),
  );

  return pendingExchange;
}
