import { NextResponse } from 'next/server';
import { invitationCreateSchema } from '@wayfare/domain';

import { requireRouteUser } from '@/lib/supabase/route-auth';
import {
  createdTripInvitationFromDatabase,
  requireTripOwner,
  tripInvitationFromDatabase,
} from '@/lib/trips/members';

type InvitationRow = {
  id: string;
  trip_id: string;
  role: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  max_uses: number | null;
  use_count: number;
  token?: string;
};

async function ownerAuth(tripId: string) {
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const access = await requireTripOwner(auth.supabase, tripId);
  if (!access)
    return NextResponse.json(
      { error: 'Only the trip owner can manage invitations.' },
      { status: 403 },
    );
  return auth;
}

export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await ownerAuth(tripId);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from('trip_invitations')
    .select('id, trip_id, role, created_at, expires_at, revoked_at, max_uses, use_count')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    invitations: ((data ?? []) as InvitationRow[]).map(tripInvitationFromDatabase),
  });
}

export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invitation details must be JSON.' }, { status: 400 });
  }
  const input = invitationCreateSchema.safeParse(body);
  if (!input.success) return NextResponse.json({ error: input.error.flatten() }, { status: 400 });

  const auth = await ownerAuth(tripId);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase.rpc('create_trip_invitation', {
    target_trip_id: tripId,
    target_role: input.data.role,
    target_expires_at: input.data.expiresAt ?? null,
    target_max_uses: input.data.maxUses ?? null,
  });
  if (error || !data)
    return NextResponse.json(
      { error: error?.message ?? 'The invitation could not be created.' },
      { status: 400 },
    );

  return NextResponse.json(
    { invitation: createdTripInvitationFromDatabase(data as InvitationRow) },
    { status: 201 },
  );
}
