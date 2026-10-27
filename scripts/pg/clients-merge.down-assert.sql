DO $$ BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN RAISE EXCEPTION 'clients still exists'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'client_id') THEN RAISE EXCEPTION 'client_id still exists'; END IF;
  IF (SELECT count(*) FROM public.invoices) <> 5 THEN RAISE EXCEPTION 'invoice count'; END IF;
  IF (SELECT ai_client_id FROM public.invoices WHERE total_cents = 1900) <> 'alpha' THEN RAISE EXCEPTION 'alpha invoice lost'; END IF;
  IF (SELECT ai_client_id FROM public.invoices WHERE total_cents = 4200) <> 'alpha' THEN RAISE EXCEPTION 'post-merge invoice not restored'; END IF;
  IF (SELECT recipient_email FROM public.invoices WHERE total_cents = 500) <> 'one@time.com' THEN RAISE EXCEPTION 'one-time lost'; END IF;
END $$;
