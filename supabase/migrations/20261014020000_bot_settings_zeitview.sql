-- Zeitview profile fields the drone-gigs bot syncs from the bot_settings row.
-- Apply after 20261013180000_bot_settings.sql.
--
-- zeitview_radius_miles null means keep the radius already on Zeitview.
-- The bot writes the sync columns. The dashboard writes only the radius.
--
-- The existing row policies (bot_settings_admin_select and
-- bot_settings_admin_update) already cover every column on this row, and
-- the table grants already include columns added later. Do not add a
-- permissive policy.

ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS zeitview_radius_miles numeric,
  ADD COLUMN IF NOT EXISTS zeitview_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS zeitview_last_result text,
  ADD COLUMN IF NOT EXISTS zeitview_last_error text,
  ADD COLUMN IF NOT EXISTS zeitview_observed jsonb;

ALTER TABLE public.bot_settings
  DROP CONSTRAINT IF EXISTS bot_settings_zeitview_radius_miles_check;

ALTER TABLE public.bot_settings
  ADD CONSTRAINT bot_settings_zeitview_radius_miles_check
  CHECK (
    zeitview_radius_miles IS NULL
    OR zeitview_radius_miles IN (10, 25, 50, 100, 200)
  );

ALTER TABLE public.bot_settings
  DROP CONSTRAINT IF EXISTS bot_settings_zeitview_last_result_check;

ALTER TABLE public.bot_settings
  ADD CONSTRAINT bot_settings_zeitview_last_result_check
  CHECK (
    zeitview_last_result IS NULL
    OR zeitview_last_result IN ('ok', 'failed')
  );

COMMENT ON COLUMN public.bot_settings.zeitview_radius_miles IS
  'Travel radius in miles the bot sets on the Zeitview profile. Null keeps the radius already there. Allowed values are 10, 25, 50, 100, and 200.';

COMMENT ON COLUMN public.bot_settings.zeitview_last_synced_at IS
  'When the bot last tried to sync the Zeitview profile.';

COMMENT ON COLUMN public.bot_settings.zeitview_last_result IS
  'ok when the last Zeitview profile sync succeeded, failed when it did not.';

COMMENT ON COLUMN public.bot_settings.zeitview_last_error IS
  'Error from the last failed Zeitview profile sync. Null after a successful sync.';

COMMENT ON COLUMN public.bot_settings.zeitview_observed IS
  'Address parts and travel_distance the bot last read from the Zeitview profile.';
