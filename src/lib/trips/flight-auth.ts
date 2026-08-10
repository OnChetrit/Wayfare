import type { SupabaseClient, User } from '@supabase/supabase-js';

export async function getTripEditorContext(supabase: SupabaseClient, user: User, tripId: string) {
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, start_date, end_date, owner_id')
    .eq('id', tripId)
    .single();
  if (tripError || !trip) return { error: 'Trip not found' as const };

  if (trip.owner_id === user.id) return { trip };

  const { data: membership } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['OWNER', 'EDITOR'].includes(membership.role)) {
    return { error: 'Only trip editors can manage flights' as const };
  }

  return { trip };
}
