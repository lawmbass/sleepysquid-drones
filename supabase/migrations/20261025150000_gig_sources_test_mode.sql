-- FlyGuys one-shot test mode (drone-gigs PR #42). NOT applied yet.
-- The bot switches test_mode off itself after its one successful test accept.
ALTER TABLE public.gig_sources
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_rules jsonb,
  ADD COLUMN IF NOT EXISTS test_accept_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_accept_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_accept_listing text;

-- Only FlyGuys may ever run a test accept.
ALTER TABLE public.gig_sources DROP CONSTRAINT IF EXISTS gig_sources_test_mode_flyguys_only;
ALTER TABLE public.gig_sources ADD CONSTRAINT gig_sources_test_mode_flyguys_only
  CHECK (test_mode = false OR source_key = 'flyguys');

COMMENT ON COLUMN public.gig_sources.test_mode IS
  'One-shot test accept. The bot sets it false after the single successful accept (test_accept_used_at).';
