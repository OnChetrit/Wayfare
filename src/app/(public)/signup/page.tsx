import { redirect } from 'next/navigation';

import { LoginForm } from '@/features/auth/LoginForm';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();

    if (claimsData?.claims.sub) redirect('/editor');
  }

  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <LoginForm
      mode="signup"
      initialError={error ? 'We couldn’t complete sign-up. Please try again.' : undefined}
    />
  );
}
