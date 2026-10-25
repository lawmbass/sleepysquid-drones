-- Temporary test rules for FlyGuys and Droners (drone-gigs PR #42).
-- Approved by Lawrence 2026-10-25: 240 min max drive, $0 minimum pay, all mission types.
-- FlyGuys: one successful test accept, then the bot sets test_mode=false itself.
--          An unclear or failed accept also sets test_mode=false (paused) and is never retried.
--          Nothing is attempted unless FLYGUYS_PORTAL_ACCEPT=on on Render.
-- Droners: test rules widen scoring and match alerts only. It never accepts.
-- Zeitview: untouched. Its Bot rules never read test_rules.
ALTER TABLE public.gig_sources
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_rules jsonb,
  ADD COLUMN IF NOT EXISTS test_accept_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_accept_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_accept_listing text,
  ADD COLUMN IF NOT EXISTS test_paused_reason text;

ALTER TABLE public.gig_sources DROP CONSTRAINT IF EXISTS gig_sources_test_mode_flyguys_only;
ALTER TABLE public.gig_sources DROP CONSTRAINT IF EXISTS gig_sources_test_mode_sources;
ALTER TABLE public.gig_sources ADD CONSTRAINT gig_sources_test_mode_sources
  CHECK (test_mode = false OR source_key IN ('flyguys', 'droners'));

COMMENT ON COLUMN public.gig_sources.test_mode IS
  'Temporary test rules. FlyGuys: one-shot test accept, then false. Droners: scoring/alerts only.';

UPDATE public.gig_sources
   SET test_mode = true,
       test_rules = '{"max_drive_minutes": 240, "min_payout_usd": 0, "mission_types": ["*"]}'::jsonb
 WHERE source_key IN ('flyguys', 'droners');

-- Check: expect 2 rows with test_mode true (flyguys, droners) and zeitview false.
SELECT source_key, enabled, test_mode, test_rules FROM public.gig_sources ORDER BY source_key;
