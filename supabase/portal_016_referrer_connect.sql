-- Additive lookup for referral payout accounts.
-- stripe_account_id and payouts_enabled already exist on portal.referrers
-- (portal_014). These statements only add them when a database is missing them,
-- then index the account id used by the account.updated webhook.
-- Do not apply to production from this change. Safe to re-run.

alter table portal.referrers add column if not exists stripe_account_id text;
alter table portal.referrers add column if not exists payouts_enabled boolean not null default false;

create index if not exists referrers_stripe_account_idx
  on portal.referrers (stripe_account_id)
  where stripe_account_id is not null;
