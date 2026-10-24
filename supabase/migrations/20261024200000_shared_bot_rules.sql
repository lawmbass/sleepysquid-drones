-- Shared bot rules for every connected gig source.
-- Not applied by this change. Apply after 20261024010000_gig_sources.sql.
--
-- Deploy order, because the live drone-gigs bot still reads
-- bot_settings.zeitview_radius_miles and still writes the Zeitview sync
-- columns on bot_settings:
--   1. Apply 20261024010000_gig_sources.sql if it is not applied yet.
--   2. Apply this file. It copies the current radius (the saved value is
--      100 miles) into travel_radius_miles and keeps zeitview_radius_miles
--      as a compatibility column a trigger fills from the shared value.
--   3. Deploy this dashboard. It reads and writes travel_radius_miles only.
--   4. Leave the drone-gigs bot running. It keeps reading the compatibility
--      column, which the trigger snaps to 10, 25, 50, 100, or 200.
--   5. Update the bot to read travel_radius_miles and to write profile sync
--      on gig_sources. Only after that deploy, drop the compatibility
--      columns in a later migration. This file does not drop them.
--
-- Do not accept missions from this migration. It only stores rules and
-- source rows.

-- Shared travel radius. Null means leave the distance already set on each
-- site. No site name: Zeitview, Droners, and FlyGuys all read this column.
ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS travel_radius_miles numeric;

UPDATE public.bot_settings
SET travel_radius_miles = zeitview_radius_miles
WHERE id = 1
  AND travel_radius_miles IS NULL
  AND zeitview_radius_miles IS NOT NULL;

ALTER TABLE public.bot_settings
  DROP CONSTRAINT IF EXISTS bot_settings_travel_radius_miles_check;

ALTER TABLE public.bot_settings
  ADD CONSTRAINT bot_settings_travel_radius_miles_check
  CHECK (
    travel_radius_miles IS NULL
    OR (travel_radius_miles >= 1 AND travel_radius_miles <= 500)
  );

COMMENT ON COLUMN public.bot_settings.travel_radius_miles IS
  'Shared travel radius in miles for every connected gig source. Null leaves the distance already set on each site. The dashboard writes this column. Droners uses it as Max distance in miles. A trigger copies a Zeitview-safe snap into zeitview_radius_miles for the live bot.';

COMMENT ON COLUMN public.bot_settings.zeitview_radius_miles IS
  'DEPRECATED compatibility column. The live drone-gigs bot still reads this. A trigger sets it from travel_radius_miles, snapped to 10, 25, 50, 100, or 200. The dashboard must not write it. Drop it only after the bot reads travel_radius_miles.';

COMMENT ON COLUMN public.bot_settings.zeitview_last_synced_at IS
  'DEPRECATED. The live bot still writes this. A trigger copies it to gig_sources for source_key zeitview. The dashboard reads gig_sources.';

COMMENT ON COLUMN public.bot_settings.zeitview_last_result IS
  'DEPRECATED. The live bot still writes this. A trigger copies it to gig_sources.profile_sync_result for Zeitview.';

COMMENT ON COLUMN public.bot_settings.zeitview_last_error IS
  'DEPRECATED. The live bot still writes this. A trigger copies it to gig_sources.profile_sync_error for Zeitview.';

COMMENT ON COLUMN public.bot_settings.zeitview_observed IS
  'DEPRECATED. The live bot still writes this. A trigger copies it to gig_sources.profile_sync_observed for Zeitview.';

-- Keep the compatibility radius aligned with the shared column.
-- Prefer travel_radius_miles. If an older writer changes only
-- zeitview_radius_miles, copy that value back into the shared column.
CREATE OR REPLACE FUNCTION public.bot_settings_keep_travel_radius()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  options numeric[] := ARRAY[10, 25, 50, 100, 200];
  choice numeric;
  best numeric := NULL;
  best_distance numeric := NULL;
  distance numeric;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.travel_radius_miles IS NOT DISTINCT FROM OLD.travel_radius_miles
     AND NEW.zeitview_radius_miles IS DISTINCT FROM OLD.zeitview_radius_miles THEN
    NEW.travel_radius_miles := NEW.zeitview_radius_miles;
    RETURN NEW;
  END IF;

  IF NEW.travel_radius_miles IS NULL THEN
    NEW.zeitview_radius_miles := NULL;
    RETURN NEW;
  END IF;

  FOREACH choice IN ARRAY options LOOP
    distance := abs(choice - NEW.travel_radius_miles);
    IF best IS NULL OR distance < best_distance OR (distance = best_distance AND choice > best) THEN
      best := choice;
      best_distance := distance;
    END IF;
  END LOOP;

  NEW.zeitview_radius_miles := best;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_settings_keep_travel_radius ON public.bot_settings;
CREATE TRIGGER bot_settings_keep_travel_radius
  BEFORE INSERT OR UPDATE ON public.bot_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_settings_keep_travel_radius();

-- Per-source profile sync. The dashboard writes profile_sync_requested_at
-- for enabled rows when rules are saved. The bot writes the result columns
-- and must not change enabled or updated_by.
ALTER TABLE public.gig_sources
  ADD COLUMN IF NOT EXISTS profile_sync_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_sync_result text,
  ADD COLUMN IF NOT EXISTS profile_sync_error text,
  ADD COLUMN IF NOT EXISTS profile_sync_observed jsonb;

ALTER TABLE public.gig_sources
  DROP CONSTRAINT IF EXISTS gig_sources_profile_sync_result_check;

ALTER TABLE public.gig_sources
  ADD CONSTRAINT gig_sources_profile_sync_result_check
  CHECK (
    profile_sync_result IS NULL
    OR profile_sync_result IN ('ok', 'failed', 'nothing')
  );

COMMENT ON COLUMN public.gig_sources.profile_sync_requested_at IS
  'When the dashboard asked the bot to push the shared home address and travel radius to this source. Set only for enabled sources. The bot leaves this column alone.';

COMMENT ON COLUMN public.gig_sources.profile_sync_at IS
  'When the bot last tried to sync this source profile.';

COMMENT ON COLUMN public.gig_sources.profile_sync_result IS
  'ok, failed, or nothing. nothing means the site has no address or travel radius to update.';

COMMENT ON COLUMN public.gig_sources.profile_sync_error IS
  'Error from the last failed profile sync. Null after ok or nothing.';

COMMENT ON COLUMN public.gig_sources.profile_sync_observed IS
  'Address and distance the bot last read back from this source.';

INSERT INTO public.gig_sources (source_key, display_name, enabled)
VALUES
  ('zeitview', 'Zeitview', true),
  ('flyguys', 'FlyGuys', false),
  ('droners', 'Droners.io', false)
ON CONFLICT (source_key) DO NOTHING;

-- Copy the Zeitview sync the bot already stored, without changing enabled.
UPDATE public.gig_sources AS source
SET profile_sync_at = settings.zeitview_last_synced_at,
    profile_sync_result = settings.zeitview_last_result,
    profile_sync_error = settings.zeitview_last_error,
    profile_sync_observed = settings.zeitview_observed
FROM public.bot_settings AS settings
WHERE source.source_key = 'zeitview'
  AND settings.id = 1
  AND source.profile_sync_at IS NULL
  AND settings.zeitview_last_synced_at IS NOT NULL;

-- While the live bot still writes Zeitview sync on bot_settings, mirror it
-- onto the Zeitview gig_sources row. A failure here must not block that write.
CREATE OR REPLACE FUNCTION public.bot_settings_mirror_zeitview_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.zeitview_last_synced_at IS NOT DISTINCT FROM OLD.zeitview_last_synced_at
     AND NEW.zeitview_last_result IS NOT DISTINCT FROM OLD.zeitview_last_result
     AND NEW.zeitview_last_error IS NOT DISTINCT FROM OLD.zeitview_last_error
     AND NEW.zeitview_observed IS NOT DISTINCT FROM OLD.zeitview_observed THEN
    RETURN NEW;
  END IF;

  BEGIN
    UPDATE public.gig_sources
    SET profile_sync_at = NEW.zeitview_last_synced_at,
        profile_sync_result = NEW.zeitview_last_result,
        profile_sync_error = NEW.zeitview_last_error,
        profile_sync_observed = NEW.zeitview_observed
    WHERE source_key = 'zeitview';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Zeitview profile sync mirror skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_settings_mirror_zeitview_sync ON public.bot_settings;
CREATE TRIGGER bot_settings_mirror_zeitview_sync
  AFTER INSERT OR UPDATE ON public.bot_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_settings_mirror_zeitview_sync();

-- Bookings from FlyGuys and Droners. Zeitview mission ids stay DBM-shaped.
-- The new sources may use their own ids. Existing rows already satisfy this.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_source_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_source_check
  CHECK (source IN ('customer', 'zeitview', 'manual', 'flyguys', 'droners'));

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_mission_id_format;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_mission_id_format
  CHECK (
    mission_id IS NULL
    OR (
      source IN ('customer', 'manual', 'zeitview')
      AND mission_id ~ '^DBM[0-9]+$'
    )
    OR (
      source IN ('flyguys', 'droners')
      AND char_length(trim(mission_id)) BETWEEN 1 AND 80
    )
  );

COMMENT ON COLUMN public.bookings.source IS
  'customer, zeitview, manual, flyguys, or droners.';
