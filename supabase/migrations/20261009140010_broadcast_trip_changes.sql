-- Publish the durable trip-change outbox to the private Realtime topic used by
-- both clients. The API remains authoritative; broadcasts only tell clients to
-- re-fetch fresh data.
create or replace function private.broadcast_trip_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object(
        'type', 'trip.changed',
        'tripId', new.trip_id,
        'revision', new.revision,
        'entity', new.entity
      ),
      'trip.changed',
      'trip:' || new.trip_id::text,
      true
    );

    update private.trip_realtime_outbox
    set delivered_at = now(), attempts = attempts + 1
    where id = new.id;
  exception when others then
    -- Realtime delivery must never roll back the underlying trip mutation.
    -- Keep the row pending so a future dispatcher can retry it.
    update private.trip_realtime_outbox
    set attempts = attempts + 1
    where id = new.id;
    raise warning 'Could not broadcast trip change %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function private.broadcast_trip_change() from public, anon, authenticated;

drop trigger if exists trip_realtime_outbox_broadcast on private.trip_realtime_outbox;
create trigger trip_realtime_outbox_broadcast
after insert on private.trip_realtime_outbox
for each row execute function private.broadcast_trip_change();
