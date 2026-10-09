import { NextResponse } from 'next/server';
import { documentTargetSchema } from '@wayfare/domain';
import { requireRouteUser } from '@/lib/supabase/route-auth';
type Context = { params: Promise<{ tripId: string; documentId: string }> };
export async function GET(_request: Request, context: Context) {
  const { tripId, documentId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data } = await auth.supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .eq('id', documentId)
    .single();
  if (!data)
    return NextResponse.json(
      { error: 'Document unavailable. Reconnect or check trip access.' },
      { status: 404 },
    );
  if (data.url) return NextResponse.json({ url: data.url });
  const { data: access, error } = await auth.supabase.storage
    .from('trip-documents')
    .createSignedUrl(data.storage_path, 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ url: access.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function PATCH(request: Request, context: Context) {
  const { tripId, documentId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label || label.length > 200)
    return NextResponse.json({ error: 'Enter a label up to 200 characters.' }, { status: 400 });
  const { error } = await auth.supabase
    .from('trip_documents')
    .update({ label })
    .eq('trip_id', tripId)
    .eq('id', documentId);
  return NextResponse.json(error ? { error: error.message } : { renamed: true }, {
    status: error ? 400 : 200,
  });
}
export async function DELETE(request: Request, context: Context) {
  const { tripId, documentId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = documentTargetSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  const { data, error } = await auth.supabase.rpc('unlink_document', {
    target_trip: tripId,
    doc: documentId,
    target_kind: parsed.data.kind,
    target_item: parsed.data.itemId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (data) {
    const { error: storageError } = await auth.supabase.storage
      .from('trip-documents')
      .remove([data]);
    if (storageError)
      return NextResponse.json(
        { error: 'Unlinked. Stored file cleanup needs retry.' },
        { status: 503 },
      );
  }
  return NextResponse.json({ removed: true });
}
