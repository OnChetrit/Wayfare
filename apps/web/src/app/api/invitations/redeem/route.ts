import { NextResponse } from 'next/server';
import { invitationTokenSchema } from '@wayfare/domain';

import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireRouteUser } from '@/lib/supabase/route-auth';

const redeemInvitationSchema = invitationTokenSchema.transform(token => ({ token }));

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A JSON invitation token is required.' }, { status: 400 });
  }

  const result = redeemInvitationSchema.safeParse(
    body && typeof body === 'object' ? (body as { token?: unknown }).token : undefined,
  );
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;

  const { data: tripId, error } = await auth.supabase.rpc('redeem_trip_invitation', {
    invitation_token: result.data.token,
  });
  if (error || !tripId)
    return NextResponse.json(
      { error: error?.message ?? 'This invitation could not be redeemed.' },
      { status: 400 },
    );

  return NextResponse.json({ tripId });
}
