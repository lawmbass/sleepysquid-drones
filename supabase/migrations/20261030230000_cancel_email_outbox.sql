-- Outbox for the Zeitview cancel email. The dashboard queues the email on the
-- listing; the drone-gigs bot sends it from lawmbass1@gmail.com to
-- pilots@dronebase.com with its existing Gmail sign-in and records the result.
-- Apply in the Supabase SQL editor after 20261012180000_mission_listing_cancel.sql.
--
-- Who writes what:
--   dashboard: cancel_email_subject, cancel_email_body, cancel_email_message_key,
--              cancel_email_requested_at, and cancel_email_status = 'queued'.
--   bot:       cancel_email_status ('sending', 'sent', 'failed'),
--              cancel_email_attempted_at, cancel_email_sent_at,
--              cancel_email_gmail_id, cancel_email_error.
-- The bot's mission upsert must not send any of these columns.

ALTER TABLE public.mission_listings
  ADD COLUMN cancel_email_status text,
  ADD COLUMN cancel_email_subject text,
  ADD COLUMN cancel_email_body text,
  ADD COLUMN cancel_email_message_key text,
  ADD COLUMN cancel_email_requested_at timestamptz,
  ADD COLUMN cancel_email_attempted_at timestamptz,
  ADD COLUMN cancel_email_sent_at timestamptz,
  ADD COLUMN cancel_email_gmail_id text,
  ADD COLUMN cancel_email_error text;

ALTER TABLE public.mission_listings
  ADD CONSTRAINT mission_listings_cancel_email_status_check CHECK (
    cancel_email_status IS NULL
    OR cancel_email_status IN ('queued', 'sending', 'sent', 'failed')
  ),
  ADD CONSTRAINT mission_listings_cancel_email_lengths CHECK (
    (cancel_email_subject IS NULL OR char_length(cancel_email_subject) <= 300)
    AND (cancel_email_body IS NULL OR char_length(cancel_email_body) <= 5000)
    AND (cancel_email_message_key IS NULL OR char_length(cancel_email_message_key) <= 200)
    AND (cancel_email_error IS NULL OR char_length(cancel_email_error) <= 1000)
  );

-- The bot polls for open rows every minute.
CREATE INDEX mission_listings_cancel_email_open_idx
  ON public.mission_listings (cancel_email_requested_at)
  WHERE cancel_email_status IN ('queued', 'sending');

COMMENT ON COLUMN public.mission_listings.cancel_email_status IS
  'null, queued (dashboard), sending, sent, or failed (bot). A row is sent at most once per message key.';
COMMENT ON COLUMN public.mission_listings.cancel_email_message_key IS
  'RFC 5322 Message-ID for the email. The bot checks Gmail Sent for it before sending, so a retry never sends twice.';
COMMENT ON COLUMN public.mission_listings.cancel_email_gmail_id IS
  'Gmail message id of the sent cancel email. Written by the bot.';
