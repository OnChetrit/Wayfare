alter table private.trip_realtime_outbox drop constraint trip_realtime_outbox_entity_check;
alter table private.trip_realtime_outbox add constraint trip_realtime_outbox_entity_check check(entity in ('trip','days','places','schedule','stays','flights','locations','expenses','invitations','membership','documents'));
create or replace function private.record_trip_change(target_trip_id uuid, target_entity text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  if target_entity not in ('trip', 'days', 'places', 'schedule', 'stays', 'flights', 'locations', 'expenses', 'invitations', 'membership','documents') then
    raise exception 'Invalid trip realtime entity';
  end if;

  update public.trips
  set revision = revision + 1, updated_at = now()
  where id = target_trip_id
  returning revision into next_revision;
  if next_revision is null then raise exception 'Trip not found'; end if;

  insert into private.trip_realtime_outbox (trip_id, revision, entity)
  values (target_trip_id, next_revision, target_entity);
  return next_revision;
end;
$$;

-- Payment history is independent of reservation estimates and lifecycle.
drop trigger if exists stays_sync_expense on public.stays;
drop trigger if exists trip_flights_sync_expense on public.trip_flights;
drop trigger if exists trip_expenses_sync_stay_price on public.trip_expenses;
drop index if exists public.trip_expenses_one_per_stay_idx;
drop index if exists public.trip_expenses_one_per_flight_idx;
alter table public.trip_expenses drop constraint trip_expenses_stay_id_fkey,
  drop constraint trip_expenses_flight_id_fkey,
  add constraint trip_expenses_stay_id_fkey foreign key(stay_id) references public.stays(id) on delete set null,
  add constraint trip_expenses_flight_id_fkey foreign key(flight_id) references public.trip_flights(id) on delete set null,
  alter column amount type numeric,
  add column payment_status text not null default 'NEEDS_REVIEW' check(payment_status in ('PAID','UNPAID','NEEDS_REVIEW')),
  add column payment_date date,
  add column version integer not null default 1;
alter table public.trip_expenses alter column payment_status set default 'UNPAID';
alter table public.stays alter column price_amount type numeric;
alter table public.schedule_items alter column amount type numeric;

create table public.currency_catalog (
  code text primary key, name text not null, digits integer not null, active boolean not null
);
alter table public.currency_catalog enable row level security;
grant select on public.currency_catalog to authenticated;
create policy "read currency catalog" on public.currency_catalog for select to authenticated using (true);

insert into public.currency_catalog(code,name,digits,active) values ('AED','UAE Dirham',2,true),('AFN','Afghani',2,true),('ALL','Lek',2,true),('AMD','Armenian Dram',2,true),('AOA','Kwanza',2,true),('ARS','Argentine Peso',2,true),('AUD','Australian Dollar',2,true),('AWG','Aruban Florin',2,true),('AZN','Azerbaijan Manat',2,true),('BAM','Convertible Mark',2,true),('BBD','Barbados Dollar',2,true),('BDT','Taka',2,true),('BHD','Bahraini Dinar',3,true),('BIF','Burundi Franc',0,true),('BMD','Bermudian Dollar',2,true),('BND','Brunei Dollar',2,true),('BOB','Boliviano',2,true),('BRL','Brazilian Real',2,true),('BSD','Bahamian Dollar',2,true),('BTN','Ngultrum',2,true),('BWP','Pula',2,true),('BYN','Belarusian Ruble',2,true),('BZD','Belize Dollar',2,true),('CAD','Canadian Dollar',2,true),('CDF','Congolese Franc',2,true),('CHF','Swiss Franc',2,true),('CLP','Chilean Peso',0,true),('CNY','Yuan Renminbi',2,true),('COP','Colombian Peso',2,true),('CRC','Costa Rican Colon',2,true),('CUP','Cuban Peso',2,true),('CVE','Cabo Verde Escudo',2,true),('CZK','Czech Koruna',2,true),('DJF','Djibouti Franc',0,true),('DKK','Danish Krone',2,true),('DOP','Dominican Peso',2,true),('DZD','Algerian Dinar',2,true),('EGP','Egyptian Pound',2,true),('ERN','Nakfa',2,true),('ETB','Ethiopian Birr',2,true),('EUR','Euro',2,true),('FJD','Fiji Dollar',2,true),('FKP','Falkland Islands Pound',2,true),('GBP','Pound Sterling',2,true),('GEL','Lari',2,true),('GHS','Ghana Cedi',2,true),('GIP','Gibraltar Pound',2,true),('GMD','Dalasi',2,true),('GNF','Guinean Franc',0,true),('GTQ','Quetzal',2,true),('GYD','Guyana Dollar',2,true),('HKD','Hong Kong Dollar',2,true),('HNL','Lempira',2,true),('HTG','Gourde',2,true),('HUF','Forint',2,true),('IDR','Rupiah',2,true),('ILS','New Israeli Sheqel',2,true),('INR','Indian Rupee',2,true),('IQD','Iraqi Dinar',3,true),('IRR','Iranian Rial',2,true),('ISK','Iceland Krona',0,true),('JMD','Jamaican Dollar',2,true),('JOD','Jordanian Dinar',3,true),('JPY','Yen',0,true),('KES','Kenyan Shilling',2,true),('KGS','Som',2,true),('KHR','Riel',2,true),('KMF','Comorian Franc ',0,true),('KPW','North Korean Won',2,true),('KRW','Won',0,true),('KWD','Kuwaiti Dinar',3,true),('KYD','Cayman Islands Dollar',2,true),('KZT','Tenge',2,true),('LAK','Lao Kip',2,true),('LBP','Lebanese Pound',2,true),('LKR','Sri Lanka Rupee',2,true),('LRD','Liberian Dollar',2,true),('LSL','Loti',2,true),('LYD','Libyan Dinar',3,true),('MAD','Moroccan Dirham',2,true),('MDL','Moldovan Leu',2,true),('MGA','Malagasy Ariary',2,true),('MKD','Denar',2,true),('MMK','Kyat',2,true),('MNT','Tugrik',2,true),('MOP','Pataca',2,true),('MRU','Ouguiya',2,true),('MUR','Mauritius Rupee',2,true),('MVR','Rufiyaa',2,true),('MWK','Malawi Kwacha',2,true),('MXN','Mexican Peso',2,true),('MYR','Malaysian Ringgit',2,true),('MZN','Mozambique Metical',2,true),('NAD','Namibia Dollar',2,true),('NGN','Naira',2,true),('NIO','Cordoba Oro',2,true),('NOK','Norwegian Krone',2,true),('NPR','Nepalese Rupee',2,true),('NZD','New Zealand Dollar',2,true),('OMR','Rial Omani',3,true),('PAB','Balboa',2,true),('PEN','Sol',2,true),('PGK','Kina',2,true),('PHP','Philippine Peso',2,true),('PKR','Pakistan Rupee',2,true),('PLN','Zloty',2,true),('PYG','Guarani',0,true),('QAR','Qatari Rial',2,true),('RON','Romanian Leu',2,true),('RSD','Serbian Dinar',2,true),('RUB','Russian Ruble',2,true),('RWF','Rwanda Franc',0,true),('SAR','Saudi Riyal',2,true),('SBD','Solomon Islands Dollar',2,true),('SCR','Seychelles Rupee',2,true),('SDG','Sudanese Pound',2,true),('SEK','Swedish Krona',2,true),('SGD','Singapore Dollar',2,true),('SHP','Saint Helena Pound',2,true),('SLE','Leone',2,true),('SOS','Somali Shilling',2,true),('SRD','Surinam Dollar',2,true),('SSP','South Sudanese Pound',2,true),('STN','Dobra',2,true),('SVC','El Salvador Colon',2,true),('SYP','Syrian Pound',2,true),('SZL','Lilangeni',2,true),('THB','Baht',2,true),('TJS','Somoni',2,true),('TMT','Turkmenistan New Manat',2,true),('TND','Tunisian Dinar',3,true),('TOP','Pa’anga',2,true),('TRY','Turkish Lira',2,true),('TTD','Trinidad and Tobago Dollar',2,true),('TWD','New Taiwan Dollar',2,true),('TZS','Tanzanian Shilling',2,true),('UAH','Hryvnia',2,true),('UGX','Uganda Shilling',0,true),('USD','US Dollar',2,true),('UYU','Peso Uruguayo',2,true),('UZS','Uzbekistan Sum',2,true),('VED','Bolívar Soberano',2,true),('VES','Bolívar Soberano',2,true),('VND','Dong',0,true),('VUV','Vatu',0,true),('WST','Tala',2,true),('XAF','CFA Franc BEAC',0,true),('XCD','East Caribbean Dollar',2,true),('XCG','Caribbean Guilder',2,true),('XOF','CFA Franc BCEAO',0,true),('XPF','CFP Franc',0,true),('YER','Yemeni Rial',2,true),('ZAR','Rand',2,true),('ZMW','Zambian Kwacha',2,true),('ZWG','Zimbabwe Gold',2,true);

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  kind text not null check(kind in ('ACTIVITY','HOTEL','FLIGHT')),
  item_id uuid,
  title text not null,
  date date not null,
  category text not null,
  allocated_amount numeric check(allocated_amount >= 0),
  unique(kind, item_id)
);
create index expense_items_expense_idx on public.expense_items(expense_id);
create index expense_items_trip_idx on public.expense_items(trip_id);
alter table public.expense_items enable row level security;
grant select on public.expense_items to authenticated;
create policy "members read payment coverage" on public.expense_items for select to authenticated using(private.is_trip_member(trip_id));
-- Legacy links are backfilled without changing any expense amounts.
insert into public.expense_items(trip_id,expense_id,kind,item_id,title,date,category)
select e.trip_id,e.id,'HOTEL',s.id,s.name,s.check_in_date,'HOTEL' from public.trip_expenses e join public.stays s on s.id=e.stay_id
union all select e.trip_id,e.id,'FLIGHT',f.id,f.flight_number,f.departure_date,'FLIGHT' from public.trip_expenses e join public.trip_flights f on f.id=e.flight_id
union all select e.trip_id,e.id,'ACTIVITY',s.id,coalesce(s.title_override,e.title),d.local_date,e.category::text from public.trip_expenses e join public.schedule_items s on s.id=e.schedule_item_id join public.trip_days d on d.id=s.trip_day_id
on conflict(kind,item_id) do nothing;

create function private.preserve_payment_item() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.expense_items set item_id=null where item_id=old.id and kind=tg_argv[0];
  return old;
end $$;
create trigger preserve_stay_payment before delete on public.stays for each row execute function private.preserve_payment_item('HOTEL');
create trigger preserve_flight_payment before delete on public.trip_flights for each row execute function private.preserve_payment_item('FLIGHT');
create trigger preserve_activity_payment before delete on public.schedule_items for each row execute function private.preserve_payment_item('ACTIVITY');

create function private.save_payment(target_trip uuid, target_id uuid, payload jsonb) returns public.trip_expenses
language plpgsql security definer set search_path = '' as $$
declare
  previous public.trip_expenses; result public.trip_expenses;
  entry jsonb; item_title text; item_date date; item_category text;
  other_id uuid; precision integer; allocated_count integer; coverage_count integer; allocated_total numeric;
  chosen_currency text; chosen_amount numeric;
begin
  if not private.is_trip_editor(target_trip) then raise exception 'Editing permission required' using errcode='42501'; end if;
  -- Serializes coverage moves and combines within a trip.
  perform 1 from public.trips where id=target_trip for update;
  if target_id is not null then
    select * into previous from public.trip_expenses where id=target_id and trip_id=target_trip for update;
    if not found then raise exception 'Expense not found'; end if;
    if (payload->>'expectedVersion')::integer is distinct from previous.version then
      raise exception 'STALE_VERSION: Refresh this payment before saving.' using errcode='40001';
    end if;
    if not payload ? 'coverage' and (select count(*) from public.expense_items where expense_id=target_id)>1 then
      raise exception 'CLIENT_UPDATE_REQUIRED: Open this shared payment in an updated client.';
    end if;
  end if;
  chosen_currency := coalesce(payload->>'currency', previous.currency);
  chosen_amount := coalesce((payload->>'amount')::numeric,previous.amount);
  select digits into precision from public.currency_catalog where code=chosen_currency and (active or code=previous.currency);
  if precision is null then raise exception 'Choose a supported currency'; end if;
  if chosen_amount < 0 or chosen_amount <> trunc(chosen_amount,precision) then raise exception 'Invalid currency precision; amount was not rounded'; end if;
  if previous.payment_status='PAID' and coalesce(payload->>'paymentStatus',previous.payment_status)='PAID'
    and (chosen_amount is distinct from previous.amount or chosen_currency is distinct from previous.currency or payload ? 'coverage')
    and not coalesce((payload->>'confirmPaid')::boolean,false) then
    raise exception 'PAYMENT_CONFIRMATION_REQUIRED: Confirm the revised payment remains paid or switch to unpaid.';
  end if;
  if target_id is null then
    insert into public.trip_expenses(trip_id,title,category,amount,currency,expense_date,notes,payment_status,payment_date,created_by)
    values(target_trip,payload->>'title',(payload->>'category')::public.trip_expense_category,chosen_amount,chosen_currency,(payload->>'expenseDate')::date,payload->>'notes',coalesce(payload->>'paymentStatus','UNPAID'),(payload->>'paymentDate')::date,auth.uid()) returning * into result;
  else
    update public.trip_expenses set title=coalesce(payload->>'title',title),category=coalesce((payload->>'category')::public.trip_expense_category,category),amount=chosen_amount,currency=chosen_currency,
      expense_date=coalesce((payload->>'expenseDate')::date,expense_date),notes=case when payload ? 'notes' then payload->>'notes' else notes end,
      payment_status=coalesce(payload->>'paymentStatus',payment_status),payment_date=case when payload ? 'paymentDate' then (payload->>'paymentDate')::date else payment_date end,
      version=version+1,updated_at=now() where id=target_id returning * into result;
  end if;
  if payload ? 'coverage' then
    delete from public.expense_items where expense_id=result.id and item_id is not null;
    for entry in select value from jsonb_array_elements(payload->'coverage') loop
      item_title:=null; item_date:=null;
      if entry->>'kind'='HOTEL' then
        select name,check_in_date,'HOTEL' into item_title,item_date,item_category from public.stays where id=(entry->>'itemId')::uuid and trip_id=target_trip;
      elsif entry->>'kind'='FLIGHT' then
        select flight_number,departure_date,'FLIGHT' into item_title,item_date,item_category from public.trip_flights where id=(entry->>'itemId')::uuid and trip_id=target_trip;
      elsif entry->>'kind'='ACTIVITY' then
        select coalesce(s.title_override,p.custom_name,'Activity'),d.local_date,case s.category::text when 'RESTAURANT' then 'RESTAURANT' when 'CAFE' then 'RESTAURANT' when 'BAR' then 'RESTAURANT' when 'SHOPPING' then 'SHOPPING' when 'TRANSPORT' then 'TRANSPORT' when 'ATTRACTION' then 'TICKETS' else 'OTHER' end
        into item_title,item_date,item_category from public.schedule_items s join public.trip_days d on d.id=s.trip_day_id left join public.saved_places p on p.id=s.saved_place_id where s.id=(entry->>'itemId')::uuid and d.trip_id=target_trip;
      end if;
      if item_title is null then raise exception 'Covered item does not belong to this trip'; end if;
      select expense_id into other_id from public.expense_items where kind=entry->>'kind' and item_id=(entry->>'itemId')::uuid;
      if other_id is not null then
        if not coalesce((payload->'moveFrom'->>other_id::text)::integer = (select version from public.trip_expenses where id=other_id),false) then
          raise exception 'COVERAGE_CONFIRMATION_REQUIRED: Review the existing payment before moving coverage.';
        end if;
        -- Retain the previous amount, notes, receipts and a descriptive snapshot.
        update public.expense_items set item_id=null where kind=entry->>'kind' and item_id=(entry->>'itemId')::uuid;
        update public.trip_expenses set version=version+1 where id=other_id;
      end if;
      if (entry->>'allocatedAmount')::numeric <> trunc((entry->>'allocatedAmount')::numeric,precision) then raise exception 'Invalid allocation precision'; end if;
      insert into public.expense_items(trip_id,expense_id,kind,item_id,title,date,category,allocated_amount)
      values(target_trip,result.id,entry->>'kind',(entry->>'itemId')::uuid,item_title,item_date,item_category,(entry->>'allocatedAmount')::numeric);
    end loop;
    select count(*),count(allocated_amount),sum(allocated_amount) into coverage_count,allocated_count,allocated_total from public.expense_items where expense_id=result.id;
    if allocated_count>0 and (allocated_count<>coverage_count or allocated_total<>chosen_amount) then raise exception 'Allocate every item and reconcile shares to the payment total'; end if;
    -- Compatibility fields only describe unambiguous single-item coverage.
    update public.trip_expenses set stay_id=null,flight_id=null,schedule_item_id=null where id=result.id;
    if coverage_count=1 then
      update public.trip_expenses e set stay_id=case when i.kind='HOTEL' then i.item_id end,flight_id=case when i.kind='FLIGHT' then i.item_id end,schedule_item_id=case when i.kind='ACTIVITY' then i.item_id end from public.expense_items i where e.id=result.id and i.expense_id=e.id;
    end if;
  end if;
  perform private.record_trip_change(target_trip,'expenses');
  select * into result from public.trip_expenses where id=result.id;
  return result;
end $$;
revoke all on function private.save_payment(uuid,uuid,jsonb) from public,anon;
grant execute on function private.save_payment(uuid,uuid,jsonb) to authenticated;
create function public.save_payment(target_trip uuid,target_id uuid,payload jsonb) returns public.trip_expenses language sql security invoker set search_path='' as $$ select private.save_payment(target_trip,target_id,payload) $$;
revoke all on function public.save_payment(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_payment(uuid,uuid,jsonb) to authenticated;
-- All payment edits must use the transactional contract. Deletes remain governed by existing editor RLS.
revoke insert,update on public.trip_expenses from authenticated;
revoke all on function private.preserve_payment_item() from public,anon,authenticated;
alter table public.schedule_items add column reservation_locked boolean not null default false, add column mutation_version integer not null default 1;
alter table public.stays add column reservation_locked boolean not null default false, add column mutation_version integer not null default 1;
alter table public.trip_flights add column reservation_locked boolean not null default false, add column mutation_version integer not null default 1;

create function private.protect_reservation() returns trigger language plpgsql set search_path='' as $$
declare before_row jsonb:=to_jsonb(old); after_row jsonb; acknowledgement jsonb; summary jsonb; title text; ignored text[];
begin
  if tg_op='UPDATE' then
    after_row:=to_jsonb(new);
    ignored:=array['mutation_version','updated_at'];
    if tg_table_name='trip_flights' then
      ignored:=ignored || array['status','revised_departure_local','revised_arrival_local','departure_terminal','departure_gate','departure_check_in_desk','arrival_terminal','arrival_gate','arrival_baggage_belt','last_updated_utc'];
    end if;
    if (before_row-ignored)=(after_row-ignored) then return new; end if;
  end if;
  if old.reservation_locked then
    acknowledgement := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb ->> 'x-reservation-confirmations';
    -- PostgREST stores header values as JSON strings.
    if jsonb_typeof(acknowledgement)='string' then acknowledgement := (acknowledgement #>> '{}')::jsonb; end if;
    title:=coalesce(before_row->>'name',before_row->>'title_override',before_row->>'flight_number','Reservation');
    summary:=case when tg_op='DELETE' then jsonb_build_object('action','Delete reservation') else
      (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(after_row-ignored) where value is distinct from before_row->key) end;
    if acknowledgement->>old.id::text is null then
      raise exception '%', jsonb_build_object('code','RESERVATION_CONFIRMATION_REQUIRED','id',old.id,'version',old.mutation_version,'title',title,'changes',summary)::text using errcode='P0001';
    elsif (acknowledgement->>old.id::text)::integer<>old.mutation_version then
      raise exception '%',jsonb_build_object('code','STALE_VERSION','title',title,'message','This reservation changed. Refresh and review the change again.')::text using errcode='40001';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  new.mutation_version:=old.mutation_version+1;
  return new;
end $$;
create trigger protect_reservation before update or delete on public.schedule_items for each row execute function private.protect_reservation();
create trigger protect_reservation before update or delete on public.stays for each row execute function private.protect_reservation();
create trigger protect_reservation before update or delete on public.trip_flights for each row execute function private.protect_reservation();
revoke all on function private.protect_reservation() from public,anon,authenticated;
create table public.trip_documents (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  label text not null check(length(trim(label)) between 1 and 200),
  url text check(url ~* '^https?://'), storage_path text unique, mime_type text,
  byte_size integer check(byte_size between 1 and 20971520), created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check((url is null) <> (storage_path is null)),
  check(storage_path is null or storage_path=trip_id::text || '/' || id::text)
);
create table public.document_links (
  document_id uuid not null references public.trip_documents(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  kind text not null check(kind in ('ACTIVITY','HOTEL','FLIGHT','PLACE','EXPENSE')),
  item_id uuid not null, primary key(document_id,kind,item_id)
);
create index document_links_trip_idx on public.document_links(trip_id);
create index trip_documents_trip_idx on public.trip_documents(trip_id);
alter table public.trip_documents enable row level security;
alter table public.document_links enable row level security;
grant select,insert,delete on public.trip_documents,public.document_links to authenticated;
grant update(label) on public.trip_documents to authenticated;
create policy "members read documents" on public.trip_documents for select to authenticated using(private.is_trip_member(trip_id));
create policy "editors add documents" on public.trip_documents for insert to authenticated with check(private.is_trip_editor(trip_id) and created_by=auth.uid() and storage_path is null and url is not null);
create policy "editors rename documents" on public.trip_documents for update to authenticated using(private.is_trip_editor(trip_id)) with check(private.is_trip_editor(trip_id));
create policy "editors remove documents" on public.trip_documents for delete to authenticated using(private.is_trip_editor(trip_id));
create policy "members read document links" on public.document_links for select to authenticated using(private.is_trip_member(trip_id));
create policy "editors add document links" on public.document_links for insert to authenticated with check(private.is_trip_editor(trip_id));
create policy "editors remove document links" on public.document_links for delete to authenticated using(private.is_trip_editor(trip_id));

create function private.document_target_trip(kind text, item uuid) returns uuid language sql stable security invoker set search_path='' as $$
 select trip_id from public.stays where kind='HOTEL' and id=item
 union all select trip_id from public.trip_flights where kind='FLIGHT' and id=item
 union all select d.trip_id from public.schedule_items s join public.trip_days d on d.id=s.trip_day_id where kind='ACTIVITY' and s.id=item
 union all select trip_id from public.saved_places where kind='PLACE' and id=item
 union all select trip_id from public.trip_expenses where kind='EXPENSE' and id=item
$$;
create function private.validate_document_link() returns trigger language plpgsql set search_path='' as $$
begin
  perform 1 from public.trip_documents where id=new.document_id and trip_id=new.trip_id for update;
  if not found or private.document_target_trip(new.kind,new.item_id) is distinct from new.trip_id then raise exception 'Document and target must belong to the same trip'; end if;
  return new;
end $$;
create trigger validate_document_link before insert or update on public.document_links for each row execute function private.validate_document_link();
create trigger documents_realtime_change after insert or update or delete on public.trip_documents for each row execute function private.trip_change_trigger('documents','trip_id');
create trigger document_links_realtime_change after insert or update or delete on public.document_links for each row execute function private.trip_change_trigger('documents','trip_id');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('trip-documents','trip-documents',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- File ingestion uses the authenticated API and server-only storage credentials.
-- No client INSERT policy: only validated bytes can be published as trip documents.
create policy "members access trip files" on storage.objects for select to authenticated using(bucket_id='trip-documents' and exists(select 1 from public.trip_documents d where d.storage_path=name and private.is_trip_member(d.trip_id)));
create policy "editors remove trip files" on storage.objects for delete to authenticated using(bucket_id='trip-documents' and private.is_trip_editor((storage.foldername(name))[1]::uuid) and not exists(select 1 from public.trip_documents d join public.document_links l on l.document_id=d.id where d.storage_path=name));

create function private.unlink_document(target_trip uuid,doc uuid,target_kind text,target_item uuid) returns text language plpgsql security definer set search_path='' as $$
declare path text;
begin
  if not private.is_trip_editor(target_trip) then raise exception 'Editing permission required' using errcode='42501'; end if;
  select storage_path into path from public.trip_documents where id=doc and trip_id=target_trip for update;
  if not found then raise exception 'Document not found'; end if;
  delete from public.document_links where document_id=doc and kind=target_kind and item_id=target_item and trip_id=target_trip;
  if exists(select 1 from public.document_links where document_id=doc) then return null; end if;
  delete from public.trip_documents where id=doc;
  perform private.record_trip_change(target_trip,'documents');
  return path;
end $$;
create function public.unlink_document(target_trip uuid,doc uuid,target_kind text,target_item uuid) returns text language sql security invoker set search_path='' as $$select private.unlink_document(target_trip,doc,target_kind,target_item)$$;
revoke all on function private.unlink_document(uuid,uuid,text,uuid),public.unlink_document(uuid,uuid,text,uuid) from public,anon;
grant execute on function private.unlink_document(uuid,uuid,text,uuid),public.unlink_document(uuid,uuid,text,uuid) to authenticated;
revoke all on function private.validate_document_link() from public,anon,authenticated;
revoke all on function private.document_target_trip(text,uuid) from public,anon;
grant execute on function private.document_target_trip(text,uuid) to authenticated;
create function private.combine_payments(target_trip uuid, selections jsonb, chosen_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare ids uuid[]; row public.trip_expenses; survivor uuid; curr text; total numeric:=0; combined_notes text:=''; chosen_title text:='';
begin
 if not private.is_trip_editor(target_trip) then raise exception 'Editing permission required' using errcode='42501'; end if;
 if chosen_status not in ('PAID','UNPAID') then raise exception 'Choose Paid or Unpaid explicitly'; end if;
 if jsonb_array_length(selections)<2 then raise exception 'Choose at least two expenses'; end if;
 select array_agg(distinct (entry->>'id')::uuid) into ids from jsonb_array_elements(selections) entry;
 if cardinality(ids)<>jsonb_array_length(selections) then raise exception 'Duplicate expense'; end if;
 perform 1 from public.trips where id=target_trip for update;
 for row in select * from public.trip_expenses where id=any(ids) and trip_id=target_trip order by id for update loop
   if not exists(select 1 from jsonb_array_elements(selections) entry where (entry->>'id')::uuid=row.id and (entry->>'version')::integer=row.version) then raise exception 'STALE_VERSION: Refresh the payments and review again'; end if;
   if curr is not null and curr<>row.currency then raise exception 'Different currencies cannot be combined'; end if;
   curr:=row.currency; total:=total+row.amount; survivor:=coalesce(survivor,row.id);
   chosen_title:=case when chosen_title='' then row.title else left(chosen_title || ' + ' || row.title,200) end;
   combined_notes:=combined_notes || case when combined_notes='' then '' else E'\n\n' end || row.title || ' · ' || row.currency || ' ' || row.amount || ' · ' || row.payment_status || E'\n' || coalesce(row.notes,'');
 end loop;
 if (select count(*) from public.trip_expenses where trip_id=target_trip and id=any(ids))<>cardinality(ids) then raise exception 'Expense not found'; end if;
 -- Every original total is preserved as a note. Incomplete allocations remain unallocated.
 if exists(select 1 from public.expense_items where expense_id=any(ids) and allocated_amount is null) then
   update public.expense_items set allocated_amount=null where expense_id=any(ids);
 end if;
 update public.trip_expenses set stay_id=null,flight_id=null,schedule_item_id=null where id=any(ids);
 update public.expense_items set expense_id=survivor where expense_id=any(ids);
 insert into public.document_links(document_id,trip_id,kind,item_id) select document_id,trip_id,'EXPENSE',survivor from public.document_links where kind='EXPENSE' and item_id=any(ids) on conflict do nothing;
 delete from public.document_links where kind='EXPENSE' and item_id=any(ids) and item_id<>survivor;
 update public.trip_expenses set title=chosen_title,amount=total,notes=combined_notes,payment_status=chosen_status,payment_date=null,version=version+1,updated_at=now() where id=survivor;
 delete from public.trip_expenses where id=any(ids) and id<>survivor;
 perform private.record_trip_change(target_trip,'expenses');
 return survivor;
end $$;
create function public.combine_payments(target_trip uuid,selections jsonb,chosen_status text) returns uuid language sql security invoker set search_path='' as $$select private.combine_payments(target_trip,selections,chosen_status)$$;
revoke all on function private.combine_payments(uuid,jsonb,text),public.combine_payments(uuid,jsonb,text) from public,anon;
grant execute on function private.combine_payments(uuid,jsonb,text),public.combine_payments(uuid,jsonb,text) to authenticated;
notify pgrst,'reload schema';

-- Keep withdrawn currencies already stored in the database readable and editable.
insert into public.currency_catalog(code,name,digits,active)
select code,code || ' (historical)',greatest(2,max(decimal_places)),false from (
 select currency code,scale(amount) decimal_places from public.trip_expenses
 union all select currency,scale(amount) from public.schedule_items where currency is not null
 union all select price_currency,scale(price_amount) from public.stays where price_currency is not null
) legacy group by code on conflict(code) do nothing;

create function private.validate_reservation_money() returns trigger language plpgsql set search_path='' as $$
declare row_data jsonb:=to_jsonb(new); currency_code text; amount numeric; precision integer;
begin
 currency_code:=row_data->>tg_argv[1];amount:=(row_data->>tg_argv[0])::numeric;
 if amount is null then return new;end if;
 select digits into precision from public.currency_catalog where currency_catalog.code=currency_code;
 if precision is null or amount<>trunc(amount,precision) then raise exception 'Invalid currency precision; amount was not rounded';end if;
 return new;
end $$;
create trigger validate_schedule_money before insert or update of amount,currency on public.schedule_items for each row execute function private.validate_reservation_money('amount','currency');
create trigger validate_stay_money before insert or update of price_amount,price_currency on public.stays for each row execute function private.validate_reservation_money('price_amount','price_currency');
revoke all on function private.validate_reservation_money() from public,anon,authenticated;

-- Parent edits and cascades are reviewed once, before any child mutation occurs.
create function private.protect_reservation_parent() returns trigger language plpgsql security definer set search_path='' as $$
declare affected jsonb; headers jsonb; missing boolean; stale boolean; target uuid;
begin
 if tg_op='UPDATE' then
 if tg_table_name='trips' and (to_jsonb(old)->>'start_date')=(to_jsonb(new)->>'start_date') and (to_jsonb(old)->>'end_date')=(to_jsonb(new)->>'end_date') then return new;end if;
 if tg_table_name='trip_days' and (to_jsonb(old)->>'local_date')=(to_jsonb(new)->>'local_date') then return new;end if;
 if tg_table_name='saved_places' and tg_op='UPDATE' and (to_jsonb(old)-array['updated_at','user_notes','is_favorite'])=(to_jsonb(new)-array['updated_at','user_notes','is_favorite']) then return new;end if;
 end if;
 target:=old.id;
 with reservations as (
  select s.id,s.mutation_version,coalesce(s.title_override,p.custom_name,'Activity') title from public.schedule_items s join public.trip_days d on d.id=s.trip_day_id left join public.saved_places p on p.id=s.saved_place_id where s.reservation_locked and ((tg_table_name='trips' and d.trip_id=target) or (tg_table_name='trip_days' and d.id=target) or (tg_table_name='saved_places' and s.saved_place_id=target))
  union all select s.id,s.mutation_version,s.name from public.stays s where s.reservation_locked and ((tg_table_name='trips' and s.trip_id=target) or (tg_table_name='saved_places' and s.saved_place_id=target))
  union all select f.id,f.mutation_version,f.flight_number from public.trip_flights f where f.reservation_locked and tg_table_name='trips' and f.trip_id=target
 ) select jsonb_agg(jsonb_build_object('id',id,'version',mutation_version,'title',title)) into affected from reservations;
 if affected is null then if tg_op='DELETE' then return old;else return new;end if;end if;
 headers:=(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-reservation-confirmations')::jsonb;
 select bool_or(headers->>(entry->>'id') is null),bool_or(headers->>(entry->>'id') is not null and headers->>(entry->>'id')<>entry->>'version') into missing,stale from jsonb_array_elements(affected) entry;
 if stale then raise exception '%',jsonb_build_object('code','STALE_VERSION','message','A locked reservation changed. Refresh and review again.')::text using errcode='40001';end if;
 if missing then raise exception '%',jsonb_build_object('code','RESERVATION_CONFIRMATION_REQUIRED','reservations',affected,'title','Locked reservations affected by this change','changes',jsonb_build_object('action',tg_op,'entity',tg_table_name))::text;end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger protect_reservation_parent before update or delete on public.trips for each row execute function private.protect_reservation_parent();
create trigger protect_reservation_parent before update or delete on public.trip_days for each row execute function private.protect_reservation_parent();
create trigger protect_reservation_parent before update or delete on public.saved_places for each row execute function private.protect_reservation_parent();
revoke all on function private.protect_reservation_parent() from public,anon,authenticated;
