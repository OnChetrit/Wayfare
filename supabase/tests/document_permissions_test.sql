begin;

select plan(3);

select ok(
  has_column_privilege('authenticated', 'public.trip_documents', 'label', 'update'),
  'authenticated members may rename documents subject to RLS'
);

select ok(
  has_column_privilege('authenticated', 'public.trip_documents', 'url', 'update'),
  'authenticated members may update saved link URLs subject to RLS'
);

select ok(
  not has_column_privilege('authenticated', 'public.trip_documents', 'storage_path', 'update'),
  'authenticated members cannot change document storage paths'
);

select * from finish();
rollback;
