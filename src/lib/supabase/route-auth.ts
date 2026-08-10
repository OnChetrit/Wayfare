import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from './server';

export async function requireRouteUser(): Promise<
  { supabase: SupabaseClient; user: User } | NextResponse
> {
  const cookieClient = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await cookieClient.auth.getSession();
  if (sessionError || !session?.access_token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = await createClient(session.access_token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  return { supabase, user };
}
