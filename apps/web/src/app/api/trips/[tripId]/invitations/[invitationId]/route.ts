import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRouteUser } from '@/lib/supabase/route-auth';
import { requireTripOwner, tripInvitationFromDatabase } from '@/lib/trips/members';

const invitationIdSchema = z.uuid();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tripId: string; invitationId: string }> },
) {
  const { tripId, invitationId } = await context.params;
  if (!invitationIdSchema.safeParse(invitationId).success)
    return NextResponse.json({ error: 'Invalid invitation.' }, { status: 400 });

  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const access = await requireTripOwner(auth.supabase, tripId);
  if (!access)
    return NextResponse.json(
      { error: 'Only the trip owner can manage invitations.' },
      { status: 403 },
    );

  const { data: existing, error: existingError } = await auth.supabase
    .from('trip_invitations')
    .select('id, trip_id, role, created_at, expires_at, revoked_at, max_uses, use_count')
    .eq('id', invitationId)
    .eq('trip_id', tripId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });

  if (existing.revoked_at)
    return NextResponse.json({ invitation: tripInvitationFromDatabase(existing) });

  const { data, error } = await auth.supabase
    .from('trip_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('trip_id', tripId)
    .select('id, trip_id, role, created_at, expires_at, revoked_at, max_uses, use_count')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ invitation: tripInvitationFromDatabase(data) });
}
