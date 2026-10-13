-- Records that the drone-gigs bot itself accepted a mission.
-- Apply after 20261012180000_mission_listing_cancel.sql.
--
-- mission_listings.status = 'accepted' is also what the completed-mission
-- backfill wrote, so it is not proof the bot accepted the gig. The bot sets
-- bot_accepted_at at the moment it accepts, and leaves it null on backfill.
-- Later upserts must omit this column. A payload that sends null will wipe it.
--
-- Existing bot accepts are copied from the linked booking's accepted_at.
-- Unlinked backfill rows stay null.

ALTER TABLE public.mission_listings
  ADD COLUMN bot_accepted_at timestamptz;

COMMENT ON COLUMN public.mission_listings.bot_accepted_at IS
  'When the drone-gigs bot accepted this mission. Null for completed-mission backfill rows. The bot must not send null on later upserts.';

UPDATE public.mission_listings AS listing
SET bot_accepted_at = booking.accepted_at
FROM public.bookings AS booking
WHERE listing.booking_id = booking.id
  AND listing.bot_accepted_at IS NULL
  AND booking.accepted_at IS NOT NULL;
