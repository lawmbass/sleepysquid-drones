-- Minimal stand-in for prod: public.users, public.invoices (after 20261027030000) and the portal schema.
DROP SCHEMA IF EXISTS portal CASCADE; DROP TABLE IF EXISTS public.invoices, public.clients, public.users CASCADE;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE public.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text NOT NULL, role text NOT NULL DEFAULT 'client',
  phone text, company text, stripe_customer_id text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ai_client_id text, recipient_email text, recipient_name text, total_cents bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_recipient_check CHECK (user_id IS NOT NULL OR ai_client_id IS NOT NULL OR recipient_email IS NOT NULL));
CREATE SCHEMA portal;
CREATE TABLE portal.clients (id text PRIMARY KEY, name text NOT NULL, is_example boolean DEFAULT false, deleted_at timestamptz, hourly_rate numeric, created_at timestamptz DEFAULT now());
CREATE TABLE portal.client_users (email text, client_id text REFERENCES portal.clients(id));
INSERT INTO public.users (id, name, email, role, company) VALUES
 ('00000000-0000-0000-0000-000000000001', 'Lawrence', 'lawrence@sleepysquid.com', 'admin', NULL),
 ('00000000-0000-0000-0000-000000000002', 'Verify Test', 'Verify@Example.com', 'client', NULL),
 ('00000000-0000-0000-0000-000000000003', 'Bo', 'bo@acme.com', 'client', 'Acme Roofing'),
 ('00000000-0000-0000-0000-000000000004', 'Pi', 'pilot@x.com', 'pilot', NULL),
 ('00000000-0000-0000-0000-000000000005', 'Cy', 'cy@twin.com', 'client', 'Twin'),
 ('00000000-0000-0000-0000-000000000006', 'Di', 'di@twin.com', 'client', 'Twin');
INSERT INTO portal.clients (id, name, hourly_rate, is_example, deleted_at) VALUES
 ('alpha', 'Alpha And Omega Solutions', 19, false, NULL),
 ('acme', 'Acme AI', 25, false, NULL),            -- merges into Acme Roofing by email
 ('twin', 'Twin', 30, false, NULL),               -- ambiguous: two users named Twin
 ('demo', 'Demo Co', 10, true, NULL),             -- example: skipped
 ('gone', 'Gone LLC', 15, false, now());          -- archived
INSERT INTO portal.client_users VALUES ('admin@alphaandomegasolutions.org', 'alpha'), ('BO@acme.com', 'acme'), ('x@gone.com', 'gone');
INSERT INTO public.invoices (user_id, ai_client_id, recipient_email, total_cents) VALUES
 ('00000000-0000-0000-0000-000000000003', NULL, NULL, 1000), (NULL, 'alpha', NULL, 1900), (NULL, NULL, 'one@time.com', 500), (NULL, 'acme', NULL, 2500);
INSERT INTO portal.clients (id, name) VALUES ('shared1', 'Shared One'), ('shared2', 'Shared Two');
INSERT INTO portal.client_users VALUES ('s@x.com', 'shared1'), ('s@x.com', 'shared2');
