-- Thin invoicing MVP (Drones, AI automation, Website dev only; Dispatch is never touched).
-- Not applied to production by this change. Apply before enabling the Invoices panel.
-- Stripe is the source of truth; `invoices` is a mirror kept current by webhooks
-- and the daily overdue cron. The app uses the service role; RLS is on with no
-- anon/authenticated policies, so these tables are server-only.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_key
  ON public.users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  overdue boolean NOT NULL DEFAULT false,
  business_lines text[] NOT NULL DEFAULT '{}',
  currency text NOT NULL DEFAULT 'usd',
  total_cents bigint NOT NULL DEFAULT 0,
  amount_due_cents bigint NOT NULL DEFAULT 0,
  amount_paid_cents bigint NOT NULL DEFAULT 0,
  due_date timestamptz,
  memo text,
  number text,
  hosted_invoice_url text,
  invoice_pdf text,
  approved_total_cents bigint,
  approved_signature text,
  last_payment_error text,
  created_by text,
  sent_at timestamptz,
  voided_at timestamptz,
  paid_at timestamptz,
  stripe_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_check CHECK (status IN ('draft','open','paid','uncollectible','void','deleted'))
);
CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON public.invoices (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_open_due_idx ON public.invoices (due_date) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
  id bigserial PRIMARY KEY,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  stripe_invoice_id text NOT NULL,
  action text NOT NULL,
  actor_email text NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  livemode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_audit_action_check CHECK (action IN ('create_draft','send','void','discard_draft'))
);
CREATE INDEX IF NOT EXISTS invoice_audit_invoice_idx ON public.invoice_audit_log (stripe_invoice_id, created_at DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoices FROM anon, authenticated;
REVOKE ALL ON public.invoice_audit_log FROM anon, authenticated;
