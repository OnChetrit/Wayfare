import { documentStorageAdmin } from '@/lib/supabase/storage-admin';
import { NextResponse } from 'next/server';
import {
  documentContentType,
  documentLinkInputSchema,
  documentMaxBytes,
  documentTargetSchema,
} from '@wayfare/domain';
import { requireRouteUser } from '@/lib/supabase/route-auth';
import { getTripAccess } from '@/lib/trips/members';
export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase
    .from('trip_documents')
    .select('*,document_links(kind,item_id)')
    .eq('trip_id', tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ documents: data });
}
export async function POST(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const auth = await requireRouteUser();
  if (auth instanceof NextResponse) return auth;
  const access = await getTripAccess(auth.supabase, tripId);
  if (!access?.canEdit)
    return NextResponse.json({ error: 'Editing permission required' }, { status: 403 });
  const id = crypto.randomUUID();
  let target;
  let row;
  let writer = auth.supabase;
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    if (Number(request.headers.get('content-length')) > documentMaxBytes + 100_000)
      return NextResponse.json({ error: 'Files must be 20 MB or smaller.' }, { status: 413 });
    const form = await request.formData();
    const parsed = documentTargetSchema.safeParse({
      kind: form.get('kind'),
      itemId: form.get('itemId'),
    });
    const file = form.get('file');
    if (!parsed.success || !(file instanceof File) || !file.size || file.size > documentMaxBytes)
      return NextResponse.json(
        { error: 'Choose a PDF, JPEG, PNG or WebP up to 20 MB.' },
        { status: 400 },
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = documentContentType(bytes);
    if (!mime || (file.type && mime !== file.type))
      return NextResponse.json(
        { error: 'The file contents do not match a supported document type.' },
        { status: 400 },
      );
    target = parsed.data;
    try {
      writer = documentStorageAdmin();
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 503 });
    }
    const path = `${tripId}/${id}`;
    const { error } = await writer.storage
      .from('trip-documents')
      .upload(path, bytes, { contentType: mime });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    row = {
      id,
      trip_id: tripId,
      label: file.name.slice(0, 200),
      storage_path: path,
      mime_type: mime,
      byte_size: file.size,
      created_by: auth.user.id,
    };
  } else {
    const input = await request.json();
    if (input.documentId) {
      const parsed = documentTargetSchema.safeParse(input);
      if (!parsed.success)
        return NextResponse.json({ error: 'Invalid document target' }, { status: 400 });
      const { error } = await auth.supabase.from('document_links').insert({
        trip_id: tripId,
        document_id: input.documentId,
        kind: parsed.data.kind,
        item_id: parsed.data.itemId,
      });
      return NextResponse.json(error ? { error: error.message } : { linked: true }, {
        status: error ? 400 : 201,
      });
    }
    const parsed = documentLinkInputSchema.safeParse(input);
    if (!parsed.success)
      return NextResponse.json(
        { error: 'Enter a label and an HTTP or HTTPS link.' },
        { status: 400 },
      );
    target = parsed.data;
    row = {
      id,
      trip_id: tripId,
      label: parsed.data.label,
      url: parsed.data.url,
      created_by: auth.user.id,
    };
  }
  const { error } = await writer.from('trip_documents').insert(row);
  const link = !error
    ? await auth.supabase
        .from('document_links')
        .insert({ document_id: id, trip_id: tripId, kind: target.kind, item_id: target.itemId })
    : { error };
  if (link.error) {
    await writer.from('trip_documents').delete().eq('id', id);
    if ('storage_path' in row)
      await writer.storage.from('trip-documents').remove([row.storage_path]);
    return NextResponse.json({ error: link.error.message }, { status: 400 });
  }
  return NextResponse.json({ id }, { status: 201 });
}
