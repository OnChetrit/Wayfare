import { redirect } from 'next/navigation';

import { LandingPage } from '@/features/landing/LandingPage';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (claimsData?.claims.sub) redirect('/editor');
  }

  return <LandingPage />;
}
