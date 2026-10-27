-- Run after the up migration on the fixture.
DO $$
DECLARE n int; r record;
BEGIN
  SELECT count(*) INTO n FROM public.clients; IF n <> 9 THEN RAISE EXCEPTION 'expected 9 clients, got %', n; END IF;
  IF EXISTS (SELECT 1 FROM public.clients c JOIN public.users u ON u.id = c.user_id WHERE u.role = 'admin' OR c.email LIKE '%@sleepysquid.com') THEN RAISE EXCEPTION 'admin became a client'; END IF;
  SELECT * INTO r FROM public.clients WHERE portal_client_id = 'alpha';
  IF r.business_name <> 'Alpha And Omega Solutions' OR r.hourly_rate <> 19 OR r.user_id IS NOT NULL OR r.services <> ARRAY['ai'] THEN RAISE EXCEPTION 'alpha wrong: %', row_to_json(r); END IF;
  SELECT * INTO r FROM public.clients WHERE portal_client_id = 'acme';
  IF r.business_name <> 'Acme Roofing' OR r.user_id IS NULL OR r.services <> ARRAY['ai','drones'] OR r.hourly_rate <> 25 THEN RAISE EXCEPTION 'acme merge wrong: %', row_to_json(r); END IF;
  SELECT * INTO r FROM public.clients WHERE portal_client_id = 'twin';
  IF r.user_id IS NOT NULL OR r.notes NOT LIKE 'MERGE REVIEW%' THEN RAISE EXCEPTION 'twin should be separate + flagged'; END IF;
  IF EXISTS (SELECT 1 FROM public.clients WHERE portal_client_id = 'demo') THEN RAISE EXCEPTION 'example client migrated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE portal_client_id = 'gone' AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'archived not kept'; END IF;
  IF (SELECT count(*) FROM public.clients WHERE email = 's@x.com') <> 1 THEN RAISE EXCEPTION 'shared email'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'verify@example.com' AND business_name = 'Verify Test') THEN RAISE EXCEPTION 'derived name/email case'; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE client_id IS NULL AND recipient_email IS NULL) THEN RAISE EXCEPTION 'unresolved invoice'; END IF;
  IF (SELECT c.portal_client_id FROM public.invoices i JOIN public.clients c ON c.id = i.client_id WHERE i.total_cents = 2500) <> 'acme' THEN RAISE EXCEPTION 'acme invoice'; END IF;
  IF (SELECT c.user_id FROM public.invoices i JOIN public.clients c ON c.id = i.client_id WHERE i.total_cents = 1000) <> '00000000-0000-0000-0000-000000000003' THEN RAISE EXCEPTION 'user invoice'; END IF;
  IF (SELECT client_id FROM public.invoices WHERE total_cents = 500) IS NOT NULL THEN RAISE EXCEPTION 'one-time got a client'; END IF;
  BEGIN INSERT INTO public.invoices (user_id, total_cents) VALUES ('00000000-0000-0000-0000-000000000003', 1); RAISE EXCEPTION 'legacy insert allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'legacy insert allowed' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.clients (business_name, services, hourly_rate) VALUES ('X', ARRAY['drones'], 5); RAISE EXCEPTION 'rate without ai allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.clients (business_name) VALUES ('Name Only');  -- saves with only a business name
  INSERT INTO public.invoices (client_id, total_cents) SELECT id, 777 FROM public.clients WHERE business_name = 'Name Only' AND false; -- (no email: invoice blocked in app, not db)
  DELETE FROM public.clients WHERE business_name = 'Name Only';
END $$;
