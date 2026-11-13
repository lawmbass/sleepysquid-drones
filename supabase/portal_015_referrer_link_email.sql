-- Additive columns for the referral-link email.
-- Apply after supabase/portal_014_referrals.sql. Do not apply to production from this change.
-- Safe to re-run. Does not drop, rewrite, or seed rows.

alter table portal.referrers
  add column if not exists link_email_sent_at timestamptz null;

alter table portal.referrers
  add column if not exists link_email_error text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'referrers_link_email_error_len'
      and conrelid = 'portal.referrers'::regclass
  ) then
    alter table portal.referrers
      add constraint referrers_link_email_error_len
      check (link_email_error is null or char_length(link_email_error) <= 300);
  end if;
end $$;

notify pgrst, 'reload schema';
