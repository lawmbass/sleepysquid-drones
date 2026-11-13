-- Soft-delete marker for a referrer who already has a paid payout or a Stripe transfer.
-- Apply after supabase/portal_014_referrals.sql. Do not apply to production from this change.
-- Safe to re-run. Adds one nullable column. Does not drop, rewrite, seed, or touch Stripe.

alter table portal.referrers
  add column if not exists deleted_at timestamptz null;

comment on column portal.referrers.deleted_at is
  'Set when a referrer with a paid payout or stripe_transfer_id is removed from the dashboard. active is false. Payment rows stay.';

notify pgrst, 'reload schema';
