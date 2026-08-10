import { redirect } from 'next/navigation';

import { TripHeaderLayout } from '@/features/trip-editor/TripHeaderLayout';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!isSupabaseConfigured()) redirect('/login');

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) redirect('/login');

  return <TripHeaderLayout>{children}</TripHeaderLayout>;
}
