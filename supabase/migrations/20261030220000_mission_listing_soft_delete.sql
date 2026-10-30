-- Dashboard-only soft delete for mission_listings.
-- NOT APPLIED. Apply in the Supabase SQL editor with Lawrence's yes, BEFORE
-- the dashboard code that reads deleted_at is deployed.
--
-- A deleted listing stays in the table so the drone-gigs bot still finds it
-- by (source, external_mission_id) and does not import the same Gmail id or
-- mission again. The bot upserts only the keys it sends and must NOT send
-- these columns, the same as cancel_status, admin_notes and tags.
-- Restore by clearing deleted_at.

ALTER TABLE public.mission_listings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text;

ALTER TABLE public.mission_listings
  DROP CONSTRAINT IF EXISTS mission_listings_deleted_by_length;
ALTER TABLE public.mission_listings
  ADD CONSTRAINT mission_listings_deleted_by_length CHECK (
    deleted_by IS NULL OR char_length(deleted_by) <= 320
  );

-- No CHECK tying deleted_at to status: the bot may later accept a mission
-- that was deleted while it was only seen, and its upsert must not fail.
-- The API enforces "accepted or completed must be cancelled first", and the
-- dashboard keeps showing an accepted, not-cancelled row even if deleted_at
-- is set.

CREATE INDEX IF NOT EXISTS mission_listings_not_deleted_last_seen_idx
  ON public.mission_listings (last_seen_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.mission_listings.deleted_at IS
  'Dashboard-only soft delete. Hidden from the dashboard when set; the row is kept for bot dedupe. The drone-gigs bot must not write this column.';
COMMENT ON COLUMN public.mission_listings.deleted_by IS
  'Admin email that deleted the listing. The drone-gigs bot must not write this column.';
