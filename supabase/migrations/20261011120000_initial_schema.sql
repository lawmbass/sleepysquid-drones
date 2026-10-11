-- SleepySquid Drones: initial Postgres schema for Supabase project
-- etbesmtdsjlmadaexvrv (https://etbesmtdsjlmadaexvrv.supabase.co).
--
-- Apply this file once, in the Supabase SQL editor or via the Supabase CLI.
-- It creates empty tables. There is no data to import from MongoDB.
--
-- Order inside this migration:
--   1. admin_allowlist + is_dashboard_admin()
--   2. users
--   3. oauth_accounts
--   4. bookings          <-- drone-gigs writes accepted missions here
--   5. promos
--   6. invitations
--   7. rate_limit_events
--   8. mission_listings  <-- drone-gigs writes every seen mission here
--   9. RLS + grants
--
-- The Next.js app checks the NextAuth session, then uses the service-role key.
-- The service role bypasses RLS. RLS is the boundary for the anon key and for
-- any future Supabase Auth JWT.

-- ---------------------------------------------------------------------------
-- 1. Admin identity for direct PostgREST access
-- ---------------------------------------------------------------------------

CREATE TABLE public.admin_allowlist (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_allowlist_email_lower CHECK (email = lower(email))
);

COMMENT ON TABLE public.admin_allowlist IS
  'Optional extra admin emails for Supabase Auth JWTs. The Next.js app does not read this table; it uses ADMIN_EMAILS plus the @sleepysquid.com rule.';

CREATE OR REPLACE FUNCTION public.is_dashboard_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@sleepysquid.com'
    OR EXISTS (
      SELECT 1
      FROM public.admin_allowlist
      WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

REVOKE ALL ON FUNCTION public.is_dashboard_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_dashboard_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. users
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL,
  image text,
  role text NOT NULL DEFAULT 'client',
  customer_id text,
  price_id text,
  has_access boolean NOT NULL DEFAULT false,
  phone text,
  company text,
  bio text,
  location text,
  website text,
  preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'theme', 'light',
    'language', 'en',
    'timezone', 'UTC',
    'dateFormat', 'MM/DD/YYYY',
    'currency', 'USD'
  ),
  notifications jsonb NOT NULL DEFAULT jsonb_build_object(
    'emailNotifications', true,
    'pushNotifications', true,
    'bookingUpdates', true,
    'bookingConfirmations', true,
    'statusUpdates', true,
    'marketingEmails', false,
    'weeklyReports', true,
    'securityAlerts', true
  ),
  password_hash text,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  two_factor_secret text,
  email_verified boolean NOT NULL DEFAULT false,
  email_verification_token text,
  email_verification_expires timestamptz,
  password_reset_token text,
  password_reset_expires timestamptz,
  password_reset_requested_at timestamptz,
  pending_email text,
  pending_email_token text,
  pending_email_expires timestamptz,
  role_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  access_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lower CHECK (email = lower(email)),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'client', 'pilot')),
  CONSTRAINT users_customer_id_check CHECK (customer_id IS NULL OR customer_id LIKE 'cus_%'),
  CONSTRAINT users_price_id_check CHECK (price_id IS NULL OR price_id LIKE 'price_%')
);

CREATE INDEX users_role_idx ON public.users (role);
CREATE INDEX users_has_access_idx ON public.users (has_access);

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.users IS
  'App profiles. Not Supabase auth.users. Passwords are bcrypt hashes in password_hash.';

-- ---------------------------------------------------------------------------
-- 3. oauth_accounts (Google links for NextAuth, not the Supabase Auth schema)
-- ---------------------------------------------------------------------------

CREATE TABLE public.oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_accounts_provider_account_unique UNIQUE (provider, provider_account_id)
);

CREATE INDEX oauth_accounts_user_id_idx ON public.oauth_accounts (user_id);

-- ---------------------------------------------------------------------------
-- 4. bookings
--
-- drone-gigs (lawmbass/drone-gigs) inserts with the service-role key.
-- Use these column names. On unique violation of bookings_mission_id_key
-- (Postgres 23505), skip the duplicate mission.
--
-- Required for every row: service, date, location, source.
-- Customer rows also need name, email, and phone (enforced by a check).
-- Mission rows may leave name, email, and phone null.
-- duration and travel_time are minutes. travel_distance is miles.
-- ---------------------------------------------------------------------------

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'customer',
  service text NOT NULL,
  package text,
  mission_id text,
  payout numeric(12, 2),
  travel_distance numeric(12, 2),
  travel_time numeric(12, 2),
  duration numeric(12, 2),
  accepted_at timestamptz,
  mission_email text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  date timestamptz NOT NULL,
  location text NOT NULL,
  details text NOT NULL DEFAULT '',
  name text,
  email text,
  phone text,
  estimated_price numeric(12, 2),
  final_price numeric(12, 2),
  applied_promo jsonb,
  status text NOT NULL DEFAULT 'pending',
  ip_address text,
  user_agent text,
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_source_check CHECK (source IN ('customer', 'zeitview', 'manual')),
  CONSTRAINT bookings_service_not_blank CHECK (char_length(trim(service)) > 0),
  CONSTRAINT bookings_package_check CHECK (
    package IS NULL OR package IN ('basic', 'standard', 'premium')
  ),
  CONSTRAINT bookings_mission_id_format CHECK (
    mission_id IS NULL OR mission_id ~ '^DBM[0-9]+$'
  ),
  CONSTRAINT bookings_mission_id_key UNIQUE (mission_id),
  CONSTRAINT bookings_payout_nonnegative CHECK (payout IS NULL OR payout >= 0),
  CONSTRAINT bookings_travel_distance_nonnegative CHECK (travel_distance IS NULL OR travel_distance >= 0),
  CONSTRAINT bookings_travel_time_nonnegative CHECK (travel_time IS NULL OR travel_time >= 0),
  CONSTRAINT bookings_duration_nonnegative CHECK (duration IS NULL OR duration >= 0),
  CONSTRAINT bookings_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT bookings_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  CONSTRAINT bookings_location_length CHECK (char_length(location) BETWEEN 1 AND 200),
  CONSTRAINT bookings_details_length CHECK (char_length(details) <= 1000),
  CONSTRAINT bookings_name_length CHECK (name IS NULL OR char_length(name) <= 100),
  CONSTRAINT bookings_estimated_price_nonnegative CHECK (estimated_price IS NULL OR estimated_price >= 0),
  CONSTRAINT bookings_final_price_nonnegative CHECK (final_price IS NULL OR final_price >= 0),
  CONSTRAINT bookings_status_check CHECK (
    status IN ('pending', 'confirmed', 'in-progress', 'completed', 'cancelled')
  ),
  CONSTRAINT bookings_admin_notes_length CHECK (char_length(admin_notes) <= 500),
  CONSTRAINT bookings_customer_contact_required CHECK (
    source <> 'customer'
    OR (
      name IS NOT NULL
      AND char_length(trim(name)) > 0
      AND email IS NOT NULL
      AND phone IS NOT NULL
    )
  )
);

CREATE INDEX bookings_email_date_idx ON public.bookings (email, date);
CREATE INDEX bookings_status_created_at_idx ON public.bookings (status, created_at DESC);
CREATE INDEX bookings_date_idx ON public.bookings (date);
CREATE INDEX bookings_source_status_idx ON public.bookings (source, status);

DROP TRIGGER IF EXISTS bookings_set_updated_at ON public.bookings;
CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.bookings IS
  'Customer bookings and auto-accepted DroneBase/Zeitview missions. drone-gigs inserts source=zeitview rows with the service role.';
COMMENT ON COLUMN public.bookings.mission_id IS
  'Unique mission id from drone-gigs, format DBM followed by digits. Null for customer bookings. Duplicate inserts raise 23505 on bookings_mission_id_key.';
COMMENT ON COLUMN public.bookings.mission_email IS
  'Original mission email from the Zeitview/DroneBase message.';
COMMENT ON COLUMN public.bookings.duration IS
  'Mission duration in minutes.';
COMMENT ON COLUMN public.bookings.travel_time IS
  'Travel time in minutes.';
COMMENT ON COLUMN public.bookings.travel_distance IS
  'Travel distance in miles.';
COMMENT ON COLUMN public.bookings.payout IS
  'Pilot payout in USD for a mission. Customer bookings use estimated_price and final_price.';
COMMENT ON COLUMN public.bookings.accepted_at IS
  'When drone-gigs auto-accepted the mission.';
COMMENT ON COLUMN public.bookings.admin_notes IS
  'Internal notes. Public inserts cannot set this.';

-- ---------------------------------------------------------------------------
-- 5. promos
-- ---------------------------------------------------------------------------

CREATE TABLE public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  discount_percentage integer NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promos_discount_range CHECK (discount_percentage BETWEEN 1 AND 100),
  CONSTRAINT promos_date_order CHECK (end_date > start_date)
);

CREATE INDEX promos_active_window_idx ON public.promos (is_active, start_date, end_date);

DROP TRIGGER IF EXISTS promos_set_updated_at ON public.promos;
CREATE TRIGGER promos_set_updated_at
  BEFORE UPDATE ON public.promos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. invitations
-- ---------------------------------------------------------------------------

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  company text,
  phone text,
  role text NOT NULL DEFAULT 'client',
  has_access boolean NOT NULL DEFAULT false,
  token text NOT NULL,
  invited_by text NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_email_lower CHECK (email = lower(email)),
  CONSTRAINT invitations_token_unique UNIQUE (token),
  CONSTRAINT invitations_role_check CHECK (role IN ('admin', 'client', 'pilot')),
  CONSTRAINT invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired'))
);

CREATE INDEX invitations_email_idx ON public.invitations (email);
CREATE INDEX invitations_status_idx ON public.invitations (status);
CREATE INDEX invitations_expires_at_idx ON public.invitations (expires_at);

DROP TRIGGER IF EXISTS invitations_set_updated_at ON public.invitations;
CREATE TRIGGER invitations_set_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. rate_limit_events (auth attempt windows)
-- ---------------------------------------------------------------------------

CREATE TABLE public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rate_limit_events_identifier_created_at_idx
  ON public.rate_limit_events (identifier, created_at);

-- ---------------------------------------------------------------------------
-- 8. mission_listings
--
-- One row per DroneBase/Zeitview mission the bot sees, including ones it
-- does not accept. Unique on (source, external_mission_id).
--
-- drone-gigs upserts with the service-role key:
--   onConflict: 'source,external_mission_id'
-- Set first_seen_at only on insert. On later sightings update last_seen_at,
-- status, decline_reason, the descriptive columns, flight_plan, and the raw
-- payloads. Do not overwrite admin_notes or tags; those belong to the dashboard.
-- When a mission is accepted, set status to 'accepted' and booking_id to the
-- bookings.id that was inserted (bookings.mission_id is the DBM id when the
-- id matches ^DBM[0-9]+$; external_mission_id stores the source id either way).
--
-- flight_plan is a jsonb array of steps:
--   { "name", "instructions", "shot_type", "altitude", "angle", "count", "required" }
-- shot_type is usually photo, video, orbit, panorama, or grid/mapping.
-- required_equipment, required_certifications, and deliverables are jsonb
-- arrays of strings or objects. raw_detail is the scraped mission page.
-- travel_distance is miles from home. travel_time and estimated_on_site_minutes
-- are minutes. payout is USD.
-- ---------------------------------------------------------------------------

CREATE TABLE public.mission_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_mission_id text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'seen',
  decline_reason text,
  title text,
  client_name text,
  mission_type text,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  payout numeric(12, 2),
  travel_distance numeric(12, 2),
  travel_time numeric(12, 2),
  due_window_start timestamptz,
  due_window_end timestamptz,
  deadline timestamptz,
  estimated_on_site_minutes numeric(12, 2),
  required_equipment jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  flight_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_email_html text,
  raw_email_text text,
  raw_detail jsonb,
  booking_id uuid REFERENCES public.bookings (id) ON DELETE SET NULL,
  admin_notes text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_listings_source_not_blank CHECK (char_length(trim(source)) > 0),
  CONSTRAINT mission_listings_external_id_not_blank CHECK (char_length(trim(external_mission_id)) > 0),
  CONSTRAINT mission_listings_source_external_unique UNIQUE (source, external_mission_id),
  CONSTRAINT mission_listings_status_check CHECK (
    status IN ('seen', 'accepted', 'declined_by_filter', 'expired', 'unavailable')
  ),
  CONSTRAINT mission_listings_payout_nonnegative CHECK (payout IS NULL OR payout >= 0),
  CONSTRAINT mission_listings_travel_distance_nonnegative CHECK (travel_distance IS NULL OR travel_distance >= 0),
  CONSTRAINT mission_listings_travel_time_nonnegative CHECK (travel_time IS NULL OR travel_time >= 0),
  CONSTRAINT mission_listings_on_site_nonnegative CHECK (
    estimated_on_site_minutes IS NULL OR estimated_on_site_minutes >= 0
  ),
  CONSTRAINT mission_listings_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT mission_listings_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  CONSTRAINT mission_listings_equipment_is_array CHECK (jsonb_typeof(required_equipment) = 'array'),
  CONSTRAINT mission_listings_certifications_is_array CHECK (jsonb_typeof(required_certifications) = 'array'),
  CONSTRAINT mission_listings_deliverables_is_array CHECK (jsonb_typeof(deliverables) = 'array'),
  CONSTRAINT mission_listings_flight_plan_is_array CHECK (jsonb_typeof(flight_plan) = 'array'),
  CONSTRAINT mission_listings_tags_is_array CHECK (jsonb_typeof(tags) = 'array'),
  CONSTRAINT mission_listings_admin_notes_length CHECK (char_length(admin_notes) <= 2000)
);

CREATE INDEX mission_listings_status_idx ON public.mission_listings (status);
CREATE INDEX mission_listings_mission_type_idx ON public.mission_listings (mission_type);
CREATE INDEX mission_listings_payout_idx ON public.mission_listings (payout);
CREATE INDEX mission_listings_travel_distance_idx ON public.mission_listings (travel_distance);
CREATE INDEX mission_listings_deadline_idx ON public.mission_listings (deadline);
CREATE INDEX mission_listings_last_seen_idx ON public.mission_listings (last_seen_at DESC);
CREATE INDEX mission_listings_booking_id_idx ON public.mission_listings (booking_id);

-- Text used by the dashboard equipment filter. Kept generated so the bot
-- only has to write the jsonb arrays.
ALTER TABLE public.mission_listings
  ADD COLUMN equipment_search text GENERATED ALWAYS AS (
    coalesce(required_equipment::text, '') || ' ' || coalesce(required_certifications::text, '')
  ) STORED;

DROP TRIGGER IF EXISTS mission_listings_set_updated_at ON public.mission_listings;
CREATE TRIGGER mission_listings_set_updated_at
  BEFORE UPDATE ON public.mission_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.mission_listings IS
  'Every mission listing the drone-gigs bot sees. Accepted missions also get a bookings row; booking_id points at it.';
COMMENT ON COLUMN public.mission_listings.external_mission_id IS
  'Source mission id. Unique together with source. Often a DBM id, but not format-checked so declined listings with other ids still store.';
COMMENT ON COLUMN public.mission_listings.decline_reason IS
  'Which acceptance rule failed when status is declined_by_filter. Free text, for example payout_below_minimum or missing_thermal.';
COMMENT ON COLUMN public.mission_listings.flight_plan IS
  'jsonb array of capture steps: name, instructions, shot_type (photo, video, orbit, panorama, grid/mapping), altitude, angle, count, required.';
COMMENT ON COLUMN public.mission_listings.tags IS
  'Admin-owned jsonb array of strings such as "have skills" or "need equipment X". The bot must not overwrite this column.';
COMMENT ON COLUMN public.mission_listings.admin_notes IS
  'Admin-owned notes. The bot must not overwrite this column.';
COMMENT ON COLUMN public.mission_listings.raw_detail IS
  'Full scraped mission page as jsonb. Use raw_email_html and raw_email_text for the original email.';

-- ---------------------------------------------------------------------------
-- 9. RLS
-- Service role bypasses these policies. Do not add USING (true) policies.
-- ---------------------------------------------------------------------------

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_listings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_allowlist FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.oauth_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.bookings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.promos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rate_limit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mission_listings FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.admin_allowlist TO service_role;
GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.oauth_accounts TO service_role;
GRANT ALL ON TABLE public.bookings TO service_role;
GRANT ALL ON TABLE public.promos TO service_role;
GRANT ALL ON TABLE public.invitations TO service_role;
GRANT ALL ON TABLE public.rate_limit_events TO service_role;
GRANT ALL ON TABLE public.mission_listings TO service_role;

-- Admins (Supabase JWT email) may manage sensitive tables. Anon has no grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.oauth_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_allowlist TO authenticated;
GRANT SELECT, DELETE ON TABLE public.rate_limit_events TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.mission_listings TO authenticated;

CREATE POLICY users_admin_all
  ON public.users
  FOR ALL
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());

CREATE POLICY oauth_accounts_admin_all
  ON public.oauth_accounts
  FOR ALL
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());

CREATE POLICY invitations_admin_all
  ON public.invitations
  FOR ALL
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());

CREATE POLICY admin_allowlist_admin_all
  ON public.admin_allowlist
  FOR ALL
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());

CREATE POLICY rate_limit_events_admin_read
  ON public.rate_limit_events
  FOR SELECT
  TO authenticated
  USING (public.is_dashboard_admin());

CREATE POLICY rate_limit_events_admin_delete
  ON public.rate_limit_events
  FOR DELETE
  TO authenticated
  USING (public.is_dashboard_admin());

-- Bookings: anon may insert a customer request and nothing else.
-- No SELECT / UPDATE / DELETE grant for anon, so anon cannot read bookings.
GRANT INSERT ON TABLE public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;

CREATE POLICY bookings_public_insert
  ON public.bookings
  FOR INSERT
  TO anon
  WITH CHECK (
    source = 'customer'
    AND status = 'pending'
    AND mission_id IS NULL
    AND payout IS NULL
    AND travel_distance IS NULL
    AND travel_time IS NULL
    AND duration IS NULL
    AND accepted_at IS NULL
    AND mission_email IS NULL
    AND latitude IS NULL
    AND longitude IS NULL
    AND final_price IS NULL
    AND (admin_notes IS NULL OR admin_notes = '')
    AND name IS NOT NULL
    AND email IS NOT NULL
    AND phone IS NOT NULL
    AND service IN (
      'aerial-photography',
      'drone-videography',
      'mapping-surveying',
      'real-estate',
      'inspection',
      'event-coverage',
      'custom'
    )
    AND date >= (CURRENT_TIMESTAMP + interval '2 days')
  );

CREATE POLICY bookings_admin_all
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());

-- Promos: anyone may read a promo that is active right now. Admins manage the rest.
GRANT SELECT ON TABLE public.promos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.promos TO authenticated;

CREATE POLICY promos_public_read_active
  ON public.promos
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND start_date <= now()
    AND end_date >= now()
  );

CREATE POLICY promos_admin_all
  ON public.promos
  FOR ALL
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());

-- Listings: admins can read and annotate. The bot writes with the service role.
-- Anon has no grant and no policy, so the public key cannot read mission emails.
CREATE POLICY mission_listings_admin_select
  ON public.mission_listings
  FOR SELECT
  TO authenticated
  USING (public.is_dashboard_admin());

CREATE POLICY mission_listings_admin_update
  ON public.mission_listings
  FOR UPDATE
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());
