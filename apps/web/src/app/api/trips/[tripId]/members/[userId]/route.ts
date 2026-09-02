import { NextResponse } from 'next/server';
import { tripMemberRoleUpdateSchema } from '@wayfare/domain';
import { z } from 'zod';

import { requireRouteUser } from '@/lib/supabase/route-auth';
import { requireTripOwner, tripMembersForTrip } from '@/lib/trips/members';

const userIdSchema = z.uuid();

async function ownerAuth(tripId: string) {
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const access = await requireTripOwner(auth.supabase, tripId);
  if (!access)
    return NextResponse.json({ error: 'Only the trip owner can manage members.' }, { status: 403 });
  return auth;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tripId: string; userId: string }> },
) {
  const { tripId, userId } = await context.params;
  if (!userIdSchema.safeParse(userId).success)
    return NextResponse.json({ error: 'Invalid member.' }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Member updates must be JSON.' }, { status: 400 });
  }
  const input = tripMemberRoleUpdateSchema.safeParse(body);
  if (!input.success) return NextResponse.json({ error: input.error.flatten() }, { status: 400 });

  const auth = await ownerAuth(tripId);
  if (auth instanceof NextResponse) return auth;
  const { error } = await auth.supabase.rpc('update_trip_member', {
    target_trip_id: tripId,
    target_user_id: userId,
    target_role: input.data.role,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    const member = (await tripMembersForTrip(auth.supabase, tripId)).find(
      item => item.userId === userId,
    );
    if (!member) return NextResponse.json({ error: 'Trip member not found.' }, { status: 404 });
    return NextResponse.json({ member });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load the updated member.' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tripId: string; userId: string }> },
) {
  const { tripId, userId } = await context.params;
  if (!userIdSchema.safeParse(userId).success)
    return NextResponse.json({ error: 'Invalid member.' }, { status: 400 });

  const auth = await ownerAuth(tripId);
  if (auth instanceof NextResponse) return auth;
  const { error } = await auth.supabase.rpc('remove_trip_member', {
    target_trip_id: tripId,
    target_user_id: userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ removed: userId });
}
