import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from './server';
import { bearerToken } from './bearer-token';

export async function requireRouteUser(): Promise<
  { supabase: SupabaseClient; user: User } | NextResponse
> {
  const requestHeaders = await headers();
  const bearer = bearerToken(requestHeaders.get('authorization'));
  const cookieClient = bearer ? null : await createClient();
  const sessionResult = cookieClient ? await cookieClient.auth.getSession() : null;
  const accessToken = bearer ?? sessionResult?.data.session?.access_token;
  if (sessionResult?.error || !accessToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = await createClient(accessToken, {
    'x-reservation-confirmations': requestHeaders.get('x-reservation-confirmations') ?? '{}',
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  return { supabase, user };
}
