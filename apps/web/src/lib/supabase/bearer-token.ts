export function bearerToken(value: string | null) {
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}
