-- Simulates the 2026-10-27 partial prod apply (table + step 1 committed, Alpha inserted as AI-only, rest missing).
DROP FUNCTION IF EXISTS public.invoices_legacy_recipient_readonly() CASCADE;

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL CHECK (btrim(business_name) <> ''),
  contact_name text,
  email text CHECK (email IS NULL OR email = lower(btrim(email))),
  phone text,
  services text[] NOT NULL DEFAULT '{}' CHECK (services <@ ARRAY['drones','ai','web']::text[]),
  hourly_rate numeric(10,2) CHECK (hourly_rate IS NULL OR (hourly_rate >= 0 AND 'ai' = ANY (services))),
  notes text,
  stripe_customer_id text,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,   -- set = "Has login"
  portal_client_id text,                                         -- portal.clients.id: the AI report's data key
  invited_at timestamptz,
  last_invite_at timestamptz,                                   -- resend rate limit
  invite_sent_count integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  migrated_from jsonb,                                           -- {user_id, ai_client_id} provenance for the down path
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_key ON public.clients (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_key ON public.clients (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_portal_client_id_key ON public.clients (portal_client_id) WHERE portal_client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_stripe_customer_id_key ON public.clients (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_active_idx ON public.clients (business_name) WHERE archived_at IS NULL;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;   -- service role only (admin API); no policies = no anon/auth access
REVOKE ALL ON public.clients FROM anon, authenticated;
GRANT ALL ON public.clients TO service_role;

-- 1. Client users -> clients (admins, pilots and @sleepysquid.com emails are never clients).
INSERT INTO public.clients (business_name, contact_name, email, phone, services, stripe_customer_id, user_id, migrated_from, created_at)
SELECT coalesce(nullif(btrim(u.company), ''), nullif(btrim(u.name), ''), lower(btrim(u.email))), nullif(btrim(u.name), ''),
       lower(btrim(u.email)), nullif(btrim(u.phone), ''), ARRAY['drones'], u.stripe_customer_id, u.id,
       jsonb_build_object('user_id', u.id), u.created_at
FROM public.users u
WHERE u.role IN ('client', 'user') AND lower(u.email) NOT LIKE '%@sleepysquid.com'
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = u.id);

-- what prod showed: Alpha inserted as AI-only (no temp tables involved), nothing else
INSERT INTO public.clients (business_name, services, hourly_rate, portal_client_id, created_at) SELECT name, ARRAY['ai'], hourly_rate, id, created_at FROM portal.clients WHERE id='alpha';
