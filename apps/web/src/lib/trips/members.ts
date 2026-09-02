import {
  createdTripInvitationSchema,
  tripAccessSchema,
  tripInvitationSchema,
  tripMemberSchema,
  type CreatedTripInvitation,
  type TripAccess,
  type TripInvitation,
  type TripMember,
} from '@wayfare/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

type AccessRow = {
  role: string;
  can_edit: boolean;
  can_manage_members: boolean;
};

type MemberRow = {
  user_id: string;
  role: string;
  joined_at: string;
  email: string;
  name: string;
};

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

export function tripAccessFromDatabase(row: AccessRow): TripAccess {
  return tripAccessSchema.parse({
    role: row.role,
    canEdit: row.can_edit,
    canManageMembers: row.can_manage_members,
  });
}

export async function getTripAccess(supabase: SupabaseClient, tripId: string) {
  const { data, error } = await supabase.rpc('trip_access_for_trip', { target_trip_id: tripId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? tripAccessFromDatabase(row as AccessRow) : null;
}

export async function requireTripOwner(supabase: SupabaseClient, tripId: string) {
  const access = await getTripAccess(supabase, tripId);
  if (!access?.canManageMembers) return null;
  return access;
}

export function tripMemberFromDatabase(row: MemberRow, tripId: string): TripMember {
  return tripMemberSchema.parse({
    userId: row.user_id,
    tripId,
    role: row.role,
    joinedAt: row.joined_at,
    email: row.email,
    name: row.name,
  });
}

function invitationFields(row: InvitationRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
  };
}

export function tripInvitationFromDatabase(row: InvitationRow): TripInvitation {
  return tripInvitationSchema.parse(invitationFields(row));
}

export function createdTripInvitationFromDatabase(row: InvitationRow): CreatedTripInvitation {
  return createdTripInvitationSchema.parse({ ...invitationFields(row), token: row.token });
}

export async function tripMembersForTrip(supabase: SupabaseClient, tripId: string) {
  const { data, error } = await supabase.rpc('trip_members_for_trip', { target_trip_id: tripId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as MemberRow[]).map(row => tripMemberFromDatabase(row, tripId));
}
