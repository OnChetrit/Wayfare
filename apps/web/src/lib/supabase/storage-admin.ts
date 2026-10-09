import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
/** Only document ingestion uses elevated storage access, after route membership checks. */
export function documentStorageAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      'Document uploads are not configured. Set SUPABASE_SERVICE_ROLE_KEY on the API server.',
    );
  return createClient(getSupabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
