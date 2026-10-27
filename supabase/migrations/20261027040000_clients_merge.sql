-- Clients merge: one public.clients table for client users (public.users role client/user) and AI clients (portal.clients).
-- Same rules as libs/clients/merge.mjs (run scripts/clients-merge-dry-run.mjs first and compare counts).
-- Reversible: supabase/down/20261027040000_clients_merge.down.sql. Sends no email, makes no Stripe calls.
-- Old data stays: users rows, portal.* rows and invoices.user_id / invoices.ai_client_id are kept (read-only) for one release.
-- One DO block = one statement, so it is atomic even in SQL editors that split statements across connections.
-- No temp tables. Idempotent: safe on a fresh DB, on a partial apply, and on reruns (rows are never duplicated).
DO $mig$
DECLARE r record;
BEGIN
  -- Table (the partial apply may have created it; every piece below is added only if missing).
  CREATE TABLE IF NOT EXISTS public.clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS business_name text,
    ADD COLUMN IF NOT EXISTS contact_name text,
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2),
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS portal_client_id text,
    ADD COLUMN IF NOT EXISTS invited_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_invite_at timestamptz,
    ADD COLUMN IF NOT EXISTS invite_sent_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS migrated_from jsonb,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE public.clients ALTER COLUMN business_name SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.clients'::regclass AND conname = 'clients_business_name_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_business_name_check CHECK (btrim(business_name) <> ''); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.clients'::regclass AND conname = 'clients_email_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_email_check CHECK (email IS NULL OR email = lower(btrim(email))); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.clients'::regclass AND conname = 'clients_services_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_services_check CHECK (services <@ ARRAY['drones','ai','web']::text[]); END IF;
  -- The original inline CHECK on hourly_rate+services was auto-named clients_check, so match on its definition.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.clients'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%hourly_rate >=%') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_hourly_rate_check CHECK (hourly_rate IS NULL OR (hourly_rate >= 0 AND 'ai' = ANY (services))); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.clients'::regclass AND conname = 'clients_user_id_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL; END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS clients_email_key ON public.clients (email) WHERE email IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_key ON public.clients (user_id) WHERE user_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS clients_portal_client_id_key ON public.clients (portal_client_id) WHERE portal_client_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS clients_stripe_customer_id_key ON public.clients (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS clients_active_idx ON public.clients (business_name) WHERE archived_at IS NULL;
  ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;   -- service role only; no policies = no anon/authenticated access
  REVOKE ALL ON public.clients FROM anon, authenticated;
  GRANT ALL ON public.clients TO service_role;

  -- 1. Client users -> clients (admins, pilots and @sleepysquid.com emails never). Skips users already present.
  INSERT INTO public.clients (business_name, contact_name, email, phone, services, stripe_customer_id, user_id, migrated_from, created_at)
  SELECT coalesce(nullif(btrim(u.company), ''), nullif(btrim(u.name), ''), lower(btrim(u.email))), nullif(btrim(u.name), ''),
         lower(btrim(u.email)), nullif(btrim(u.phone), ''), ARRAY['drones'], u.stripe_customer_id, u.id,
         jsonb_build_object('user_id', u.id), u.created_at
  FROM public.users u
  WHERE u.role IN ('client', 'user') AND lower(u.email) NOT LIKE '%@sleepysquid.com'
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.email = lower(btrim(u.email)));

  -- Fill gaps on rows a partial apply left incomplete (only NULL fields; nothing already set is changed).
  UPDATE public.clients c SET
    contact_name = coalesce(c.contact_name, nullif(btrim(u.name), '')),
    email = coalesce(c.email, CASE WHEN NOT EXISTS (SELECT 1 FROM public.clients c2 WHERE c2.email = lower(btrim(u.email)) AND c2.id <> c.id) THEN lower(btrim(u.email)) END),
    phone = coalesce(c.phone, nullif(btrim(u.phone), '')),
    stripe_customer_id = coalesce(c.stripe_customer_id, u.stripe_customer_id),
    services = CASE WHEN c.services IS NULL OR c.services = '{}' THEN ARRAY['drones'] ELSE c.services END
  FROM public.users u WHERE u.id = c.user_id;
  UPDATE public.clients c SET hourly_rate = coalesce(c.hourly_rate, pc.hourly_rate), archived_at = coalesce(c.archived_at, pc.deleted_at),
    services = CASE WHEN 'ai' = ANY (coalesce(c.services, '{}')) THEN c.services ELSE coalesce(c.services, '{}') || ARRAY['ai'] END
  FROM portal.clients pc WHERE pc.id = c.portal_client_id;

  -- 2. AI clients not yet in clients: merge into a user-client on login email or exact business name when the match is unique.
  WITH m AS (
    SELECT pc.id AS pid, c.id AS cid
    FROM portal.clients pc
    JOIN public.clients c ON c.user_id IS NOT NULL AND c.portal_client_id IS NULL
     AND (c.business_name = pc.name OR c.email IN (SELECT lower(cu.email) FROM portal.client_users cu WHERE cu.client_id = pc.id))
    WHERE NOT coalesce(pc.is_example, false)
      AND NOT EXISTS (SELECT 1 FROM public.clients x WHERE x.portal_client_id = pc.id)
  ), u AS (
    SELECT m.pid, m.cid FROM m
    WHERE (SELECT count(*) FROM m x WHERE x.pid = m.pid) = 1 AND (SELECT count(*) FROM m x WHERE x.cid = m.cid) = 1
  )
  UPDATE public.clients c
  SET services = ARRAY(SELECT DISTINCT unnest(c.services || ARRAY['ai']) ORDER BY 1),
      hourly_rate = pc.hourly_rate, portal_client_id = pc.id, archived_at = pc.deleted_at,
      migrated_from = coalesce(c.migrated_from, '{}'::jsonb) || jsonb_build_object('ai_client_id', pc.id)
  FROM u JOIN portal.clients pc ON pc.id = u.pid
  WHERE c.id = u.cid;

  -- Unmatched or ambiguous AI clients become their own rows (ambiguous ones get a review note).
  INSERT INTO public.clients (business_name, email, services, hourly_rate, portal_client_id, archived_at, notes, migrated_from, created_at)
  SELECT pc.name, NULL, ARRAY['ai'], pc.hourly_rate, pc.id, pc.deleted_at,
         CASE WHEN (SELECT count(*) FROM public.clients c WHERE c.user_id IS NOT NULL AND c.portal_client_id IS NULL
                     AND (c.business_name = pc.name OR c.email IN (SELECT lower(cu.email) FROM portal.client_users cu WHERE cu.client_id = pc.id))) > 0
              THEN 'MERGE REVIEW: matched more than one client during the clients merge' END,
         jsonb_build_object('ai_client_id', pc.id), pc.created_at
  FROM portal.clients pc
  WHERE NOT coalesce(pc.is_example, false)
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.portal_client_id = pc.id);

  -- Email per AI-only row, one at a time so two AI clients sharing a login email can't both take it.
  FOR r IN SELECT c.id, c.portal_client_id FROM public.clients c
           WHERE c.email IS NULL AND c.user_id IS NULL AND c.portal_client_id IS NOT NULL ORDER BY c.business_name LOOP
    UPDATE public.clients SET email = (SELECT lower(cu.email) FROM portal.client_users cu WHERE cu.client_id = r.portal_client_id
      AND NOT EXISTS (SELECT 1 FROM public.clients c2 WHERE c2.email = lower(cu.email)) ORDER BY lower(cu.email) LIMIT 1)
    WHERE id = r.id;
  END LOOP;

  -- Provenance for rows the partial apply inserted without it (used by the down script).
  UPDATE public.clients SET migrated_from = jsonb_strip_nulls(jsonb_build_object('user_id', user_id, 'ai_client_id', portal_client_id))
  WHERE migrated_from IS NULL AND (user_id IS NOT NULL OR portal_client_id IS NOT NULL);

  -- 3. Invoices -> client_id. One-time invoices keep recipient_email and no client.
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_id uuid;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_client_id_fkey') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT; END IF;
  CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON public.invoices (client_id, created_at DESC) WHERE client_id IS NOT NULL;
  -- The trigger blocks legacy-column changes only; client_id updates are allowed, so backfill is safe on reruns.
  UPDATE public.invoices i SET client_id = c.id FROM public.clients c WHERE i.client_id IS NULL AND i.user_id IS NOT NULL AND c.user_id = i.user_id;
  UPDATE public.invoices i SET client_id = c.id FROM public.clients c
   WHERE i.client_id IS NULL AND i.user_id IS NULL AND i.ai_client_id IS NOT NULL AND c.portal_client_id = i.ai_client_id;

  -- Fails (and rolls the whole block back) if any invoice didn't resolve.
  ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_recipient_check;
  ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_client_check;
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_check
    CHECK (client_id IS NOT NULL OR (recipient_email IS NOT NULL AND user_id IS NULL AND ai_client_id IS NULL));

  -- Legacy recipient columns are read-only for one release.
  CREATE OR REPLACE FUNCTION public.invoices_legacy_recipient_readonly() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF TG_OP = 'INSERT' AND (NEW.user_id IS NOT NULL OR NEW.ai_client_id IS NOT NULL) THEN
      RAISE EXCEPTION 'invoices.user_id / ai_client_id are read-only after the clients merge; use client_id';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.ai_client_id IS DISTINCT FROM OLD.ai_client_id) THEN
      RAISE EXCEPTION 'invoices.user_id / ai_client_id are read-only after the clients merge';
    END IF;
    RETURN NEW;
  END $fn$;
  DROP TRIGGER IF EXISTS invoices_legacy_recipient_readonly ON public.invoices;
  CREATE TRIGGER invoices_legacy_recipient_readonly BEFORE INSERT OR UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.invoices_legacy_recipient_readonly();

  COMMENT ON TABLE public.clients IS 'Drones/AI/Web clients (admins are never here). user_id set = has a portal login.';
  COMMENT ON COLUMN public.invoices.client_id IS 'Recipient client; null only for one-time invoices (recipient_email)';
END
$mig$;
