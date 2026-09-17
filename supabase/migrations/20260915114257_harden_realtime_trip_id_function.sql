-- This immutable parser is evaluated from an RLS policy; pin lookup behavior.
alter function private.realtime_trip_id(text) set search_path = '';
