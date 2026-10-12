-- Dashboard-only cancel / reschedule tracking for accepted Zeitview listings.
-- Apply this in the Supabase SQL editor after 20261011120000_initial_schema.sql.
--
-- The drone-gigs bot upserts mission_listings on (source, external_mission_id)
-- and must NOT send these columns. PostgREST updates only the keys present in
-- the payload. Omitting them leaves the values in place, the same way the bot
-- must omit admin_notes and tags. Do not select a row and upsert every column.

ALTER TABLE public.mission_listings
  ADD COLUMN cancel_status text,
  ADD COLUMN cancel_reason text,
  ADD COLUMN cancel_requested_at timestamptz,
  ADD COLUMN cancelled_at timestamptz;

ALTER TABLE public.mission_listings
  ADD CONSTRAINT mission_listings_cancel_status_check CHECK (
    cancel_status IS NULL
    OR cancel_status IN ('cancel_requested', 'reschedule_requested', 'cancelled')
  ),
  ADD CONSTRAINT mission_listings_cancel_reason_length CHECK (
    cancel_reason IS NULL OR char_length(cancel_reason) <= 2000
  );

COMMENT ON COLUMN public.mission_listings.cancel_status IS
  'Dashboard-only. null, cancel_requested, reschedule_requested, or cancelled. The drone-gigs bot must not write this column.';
COMMENT ON COLUMN public.mission_listings.cancel_reason IS
  'Dashboard-only reason sent to pilots@dronebase.com. The bot must not write this column.';
COMMENT ON COLUMN public.mission_listings.cancel_requested_at IS
  'When the pilot marked a cancel or reschedule email as requested. The bot must not write this column.';
COMMENT ON COLUMN public.mission_listings.cancelled_at IS
  'When Zeitview confirmed the cancel. The bot must not write this column.';
