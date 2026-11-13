-- Referral hub tables in the portal schema this dashboard already uses.
-- ADDITIVE. Do not apply to production from this change. No seed rows.
-- sleepysquid.com and this dashboard both read these tables with the service role.

create table if not exists portal.referrers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null check (email = lower(email)),
  phone text null,
  notes text null,
  code text not null check (code = lower(code) and code ~ '^[a-z0-9][a-z0-9-]{3,31}$'),
  active boolean not null default true,
  stripe_account_id text null,
  payouts_enabled boolean not null default false,
  archived_at timestamptz null,
  created_at timestamptz not null default now()
);
create unique index if not exists referrers_code_uidx on portal.referrers (code);
create unique index if not exists referrers_email_uidx on portal.referrers (email);

create table if not exists portal.referral_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null check (email = lower(email)),
  phone text null,
  note text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  referrer_id uuid null references portal.referrers(id),
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  decided_at timestamptz null
);

create table if not exists portal.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references portal.referrers(id),
  stripe_customer_id text null,
  customer_email text not null check (customer_email = lower(customer_email)),
  customer_name text null,
  business_line text not null default 'webdev' check (business_line in ('ai', 'drones', 'webdev')),
  payment_status text not null default 'signed_up' check (payment_status in ('signed_up', 'first_invoice_paid', 'void')),
  signed_up_at timestamptz not null default now(),
  first_paid_at timestamptz null,
  stripe_invoice_id text null
);
create unique index if not exists referrals_email_uidx on portal.referrals (customer_email);
create unique index if not exists referrals_customer_uidx on portal.referrals (stripe_customer_id) where stripe_customer_id is not null;

create table if not exists portal.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references portal.referrals(id),
  amount_cents integer not null default 20000 check (amount_cents = 20000),
  status text not null default 'pending' check (status in ('pending', 'approved_awaiting_onboarding', 'paid', 'void')),
  note text null,
  stripe_transfer_id text null,
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  paid_at timestamptz null
);

create table if not exists portal.referral_events (
  id text primary key,
  event_type text not null,
  created_at timestamptz not null default now()
);

alter table portal.referrers enable row level security;
alter table portal.referral_requests enable row level security;
alter table portal.referrals enable row level security;
alter table portal.referral_payouts enable row level security;
alter table portal.referral_events enable row level security;
revoke all on portal.referrers, portal.referral_requests, portal.referrals, portal.referral_payouts, portal.referral_events from public, anon, authenticated;
grant all on portal.referrers, portal.referral_requests, portal.referrals, portal.referral_payouts, portal.referral_events to service_role;
notify pgrst, 'reload schema';
