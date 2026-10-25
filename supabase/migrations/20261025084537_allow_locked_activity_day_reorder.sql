-- Moving an activity within its day does not alter the reservation itself.
-- Keep every other change to a locked activity behind acknowledgement.
create or replace function private.protect_reservation() returns trigger language plpgsql set search_path='' as $$
declare before_row jsonb:=to_jsonb(old); after_row jsonb; acknowledgement jsonb; summary jsonb; title text; ignored text[];
begin
  if tg_op='UPDATE' then
    after_row:=to_jsonb(new);
    ignored:=array['mutation_version','updated_at'];
    if tg_table_name='trip_flights' then
      ignored:=ignored || array['status','revised_departure_local','revised_arrival_local','departure_terminal','departure_gate','departure_check_in_desk','arrival_terminal','arrival_gate','arrival_baggage_belt','last_updated_utc'];
    end if;
    if (before_row-ignored)=(after_row-ignored) then return new; end if;
    if tg_table_name='schedule_items' and old.reservation_locked and
       (before_row-(ignored || array['sort_order']))=(after_row-(ignored || array['sort_order'])) then
      new.mutation_version:=old.mutation_version;
      return new;
    end if;
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
