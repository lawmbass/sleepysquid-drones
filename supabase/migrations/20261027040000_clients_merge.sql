-- Clients merge: one public.clients table for client users (public.users role client/user) and AI clients (portal.clients).
-- Same rules as libs/clients/merge.mjs (run scripts/clients-merge-dry-run.mjs first and compare counts).
-- Reversible: supabase/down/20261027040000_clients_merge.down.sql. Sends no email, makes no Stripe calls.
-- Old data stays: users rows, portal.* rows and invoices.user_id / invoices.ai_client_id are kept (read-only) for one release.
BEGIN;

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

-- 2. AI clients: match on login email (case-insensitive) or exact business name.
CREATE TEMP TABLE _ai_match ON COMMIT DROP AS
SELECT pc.id AS pid, c.id AS cid
FROM portal.clients pc
JOIN public.clients c ON c.user_id IS NOT NULL AND c.portal_client_id IS NULL
 AND (c.business_name = pc.name OR c.email IN (SELECT lower(cu.email) FROM portal.client_users cu WHERE cu.client_id = pc.id))
WHERE NOT coalesce(pc.is_example, false);
CREATE TEMP TABLE _ai_merge ON COMMIT DROP AS
SELECT m.pid, m.cid FROM _ai_match m
WHERE (SELECT count(*) FROM _ai_match x WHERE x.pid = m.pid) = 1
  AND (SELECT count(*) FROM _ai_match x WHERE x.cid = m.cid) = 1;

UPDATE public.clients c
SET services = ARRAY(SELECT DISTINCT unnest(c.services || ARRAY['ai']) ORDER BY 1),
    hourly_rate = pc.hourly_rate, portal_client_id = pc.id, archived_at = pc.deleted_at,
    migrated_from = c.migrated_from || jsonb_build_object('ai_client_id', pc.id)
FROM _ai_merge m JOIN portal.clients pc ON pc.id = m.pid
WHERE c.id = m.cid;

-- Unmatched or ambiguous AI clients become their own rows (ambiguous ones get a review note).
INSERT INTO public.clients (business_name, email, services, hourly_rate, portal_client_id, archived_at, notes, migrated_from, created_at)
SELECT pc.name, NULL,
       ARRAY['ai'], pc.hourly_rate, pc.id, pc.deleted_at,
       CASE WHEN EXISTS (SELECT 1 FROM _ai_match x WHERE x.pid = pc.id) THEN 'MERGE REVIEW: matched more than one client during the clients merge' END,
       jsonb_build_object('ai_client_id', pc.id), pc.created_at
FROM portal.clients pc
WHERE NOT coalesce(pc.is_example, false)
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.portal_client_id = pc.id);
-- Email per new AI row, one at a time so two AI clients sharing a login email can't both take it (second stays empty).
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT c.id, c.portal_client_id FROM public.clients c WHERE c.email IS NULL AND c.user_id IS NULL AND c.portal_client_id IS NOT NULL ORDER BY c.business_name LOOP
    UPDATE public.clients SET email = (SELECT lower(cu.email) FROM portal.client_users cu WHERE cu.client_id = r.portal_client_id
      AND NOT EXISTS (SELECT 1 FROM public.clients c2 WHERE c2.email = lower(cu.email)) ORDER BY lower(cu.email) LIMIT 1) WHERE id = r.id;
  END LOOP;
END $$;

-- 3. Invoices -> client_id. One-time invoices keep recipient_email/recipient_name and no client.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON public.invoices (client_id, created_at DESC) WHERE client_id IS NOT NULL;
UPDATE public.invoices i SET client_id = c.id FROM public.clients c WHERE i.client_id IS NULL AND i.user_id IS NOT NULL AND c.user_id = i.user_id;
UPDATE public.invoices i SET client_id = c.id FROM public.clients c WHERE i.client_id IS NULL AND i.user_id IS NULL AND i.ai_client_id IS NOT NULL AND c.portal_client_id = i.ai_client_id;

-- Every invoice now has a client or a one-time email; fails (and rolls back) if any invoice didn't resolve.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_recipient_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_check
  CHECK (client_id IS NOT NULL OR (recipient_email IS NOT NULL AND user_id IS NULL AND ai_client_id IS NULL));

-- Legacy recipient columns are read-only for one release: new rows may not set them, existing values may not change.
CREATE OR REPLACE FUNCTION public.invoices_legacy_recipient_readonly() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.user_id IS NOT NULL OR NEW.ai_client_id IS NOT NULL) THEN
    RAISE EXCEPTION 'invoices.user_id / ai_client_id are read-only after the clients merge; use client_id';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.ai_client_id IS DISTINCT FROM OLD.ai_client_id) THEN
    RAISE EXCEPTION 'invoices.user_id / ai_client_id are read-only after the clients merge';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invoices_legacy_recipient_readonly ON public.invoices;
CREATE TRIGGER invoices_legacy_recipient_readonly BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_legacy_recipient_readonly();

COMMENT ON TABLE public.clients IS 'Drones/AI/Web clients (admins are never here). user_id set = has a portal login.';
COMMENT ON COLUMN public.invoices.client_id IS 'Recipient client; null only for one-time invoices (recipient_email)';
COMMIT;
