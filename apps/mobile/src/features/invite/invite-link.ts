function normalizedToken(value: string | string[] | undefined) {
  const token = Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
  if (!token) return null;
  const normalized = token.trim();
  return /^[A-Za-z0-9_-]{1,256}$/.test(normalized) ? normalized : null;
}

export function inviteTokenFromRoute(value: string | string[] | undefined) {
  return normalizedToken(value);
}

export function inviteTokenFromUrl(value: string) {
  try {
    const url = new URL(value);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const routeSegments =
      url.protocol === 'wayfare:' && url.hostname === 'invite'
        ? pathSegments
        : pathSegments[0] === 'invite'
          ? pathSegments.slice(1)
          : [];
    return routeSegments.length === 1 ? normalizedToken(routeSegments[0]) : null;
  } catch {
    return null;
  }
}
