-- Connected gig sources for the drone-gigs bot.
-- Not applied to production by this change. Apply it before the toggle can be saved.
-- Until this table exists, the dashboard treats Zeitview as enabled.
--
-- One row per source. The dashboard writes `enabled` and `updated_by`.
-- The drone-gigs bot reads `enabled` and may write the health columns.
-- It must not change `enabled` or `updated_by`.
--
-- A missing row means that source is enabled (Zeitview keeps today's behavior).
-- `enabled = false` means the bot does not pull that source and does not
-- insert bookings for it.
--
-- last_health is the bot's last judgment, used only when the dashboard cannot
-- reach the bot's /health endpoint:
--   ok       grabbing gigs and filling bookings
--   degraded something needs fixing
--   down     broken and needs attention
-- The dashboard shows a gray dot whenever enabled is false, whatever last_health says.

CREATE TABLE public.gig_sources (
  source_key text PRIMARY KEY,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_health text,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT gig_sources_source_key_check CHECK (source_key ~ '^[a-z][a-z0-9_]{0,40}$'),
  CONSTRAINT gig_sources_display_name_check CHECK (char_length(display_name) BETWEEN 1 AND 80),
  CONSTRAINT gig_sources_last_health_check CHECK (
    last_health IS NULL OR last_health IN ('ok', 'degraded', 'down')
  )
);

COMMENT ON TABLE public.gig_sources IS
  'Gig feeds the drone-gigs bot can pull. The dashboard writes enabled. The bot reads enabled and may write last_health, last_success_at, and last_error.';

COMMENT ON COLUMN public.gig_sources.source_key IS
  'Stable id, such as zeitview. Lowercase letters, digits, and underscores.';

COMMENT ON COLUMN public.gig_sources.display_name IS
  'Name shown in Bot rules. Zeitview is spelled exactly Zeitview.';

COMMENT ON COLUMN public.gig_sources.enabled IS
  'When true, the bot pulls this source and may insert bookings. When false, it does not. Default true.';

COMMENT ON COLUMN public.gig_sources.last_health IS
  'Bot-written ok, degraded, or down. The dashboard prefers the live /health payload and uses this only as a fallback.';

COMMENT ON COLUMN public.gig_sources.last_success_at IS
  'When the bot last pulled gigs from this source and filled bookings without error.';

COMMENT ON COLUMN public.gig_sources.last_error IS
  'Short error from the bot when last_health is degraded or down. Null after a clean cycle.';

COMMENT ON COLUMN public.gig_sources.updated_by IS
  'Email of the dashboard admin who last changed enabled. The bot leaves this column alone.';

INSERT INTO public.gig_sources (source_key, display_name, enabled)
VALUES ('zeitview', 'Zeitview', true)
ON CONFLICT (source_key) DO NOTHING;

DROP TRIGGER IF EXISTS gig_sources_set_updated_at ON public.gig_sources;
CREATE TRIGGER gig_sources_set_updated_at
  BEFORE UPDATE ON public.gig_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Service role bypasses RLS. The dashboard API uses it after the admin session
-- check. A Supabase JWT for a dashboard admin may read and update rows.
-- Anon has no grant and no policy. New rows are seeded by migrations; the
-- authenticated role is not granted INSERT.
ALTER TABLE public.gig_sources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.gig_sources FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gig_sources TO service_role;
GRANT SELECT, UPDATE ON TABLE public.gig_sources TO authenticated;

CREATE POLICY gig_sources_admin_select
  ON public.gig_sources
  FOR SELECT
  TO authenticated
  USING (public.is_dashboard_admin());

CREATE POLICY gig_sources_admin_update
  ON public.gig_sources
  FOR UPDATE
  TO authenticated
  USING (public.is_dashboard_admin())
  WITH CHECK (public.is_dashboard_admin());
