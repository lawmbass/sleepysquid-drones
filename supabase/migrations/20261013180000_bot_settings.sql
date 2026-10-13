-- Acceptance rules for the drone-gigs bot.
-- Apply after 20261013140000_listing_bot_accepted_at.sql.
--
-- One row, id = 1. The bot reads this row with the service role before it
-- accepts a mission. The dashboard updates it. Do not insert a second row.
--
-- Null on max_drive_minutes, daily_accept_cap, or min_notice_hours means
-- that limit is off.

CREATE TABLE public.bot_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_accept_enabled boolean NOT NULL DEFAULT true,
  min_payout_usd numeric NOT NULL DEFAULT 50,
  long_trip_minutes int NOT NULL DEFAULT 60,
  long_trip_min_payout_usd numeric NOT NULL DEFAULT 100,
  max_drive_minutes int,
  home_address text NOT NULL DEFAULT '11205 Keystone Avenue, Clinton, MD',
  home_lat double precision NOT NULL DEFAULT 38.737679,
  home_lng double precision NOT NULL DEFAULT -76.894043,
  daily_accept_cap int,
  min_notice_hours int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

COMMENT ON TABLE public.bot_settings IS
  'Single row (id = 1) of acceptance rules for the drone-gigs bot. The bot reads it. The dashboard writes it.';

COMMENT ON COLUMN public.bot_settings.auto_accept_enabled IS
  'When false, the bot records missions and does not accept them.';

COMMENT ON COLUMN public.bot_settings.min_payout_usd IS
  'Minimum payout in USD. A lower payout is not accepted.';

COMMENT ON COLUMN public.bot_settings.long_trip_minutes IS
  'A drive this many minutes or longer is a long trip.';

COMMENT ON COLUMN public.bot_settings.long_trip_min_payout_usd IS
  'Minimum payout in USD for a long trip.';

COMMENT ON COLUMN public.bot_settings.max_drive_minutes IS
  'Drives longer than this are not accepted. Null means no maximum.';

COMMENT ON COLUMN public.bot_settings.home_address IS
  'Address drive time is measured from.';

COMMENT ON COLUMN public.bot_settings.home_lat IS
  'Latitude of home_address.';

COMMENT ON COLUMN public.bot_settings.home_lng IS
  'Longitude of home_address.';

COMMENT ON COLUMN public.bot_settings.daily_accept_cap IS
  'Most missions the bot may accept on one Eastern calendar day. Null means no cap.';

COMMENT ON COLUMN public.bot_settings.min_notice_hours IS
  'Hours the bot must see a mission before its flight time. Null means notice is not checked.';

COMMENT ON COLUMN public.bot_settings.updated_by IS
  'Email of the dashboard admin who last saved the row.';

INSERT INTO public.bot_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER bot_settings_set_updated_at
  BEFORE UPDATE ON public.bot_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Service role bypasses RLS. Dashboard admins with a Supabase JWT may read
-- and update the row. Anon has no grant and no policy.
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bot_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.bot_settings TO service_role;
GRANT SELECT, UPDATE ON TABLE public.bot_settings TO authenticated;

CREATE POLICY bot_settings_admin_select
  ON public.bot_settings
  FOR SELECT
  TO authenticated
  USING (public.is_dashboard_admin());

CREATE POLICY bot_settings_admin_update
  ON public.bot_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());
