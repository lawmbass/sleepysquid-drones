-- Invoice recipients beyond portal accounts:
--   ai_client_id                    -> portal.clients.id (AI client, no portal account)
--   recipient_email/recipient_name  -> one-time invoice to a typed email
-- user_id becomes nullable, but every invoice still has exactly one kind of recipient.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS ai_client_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE public.invoices ALTER COLUMN user_id DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_recipient_check') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_recipient_check
      CHECK (user_id IS NOT NULL OR ai_client_id IS NOT NULL OR recipient_email IS NOT NULL);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS invoices_ai_client_id_idx ON public.invoices (ai_client_id, created_at DESC) WHERE ai_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_recipient_email_idx ON public.invoices (lower(recipient_email), created_at DESC) WHERE recipient_email IS NOT NULL;
COMMENT ON COLUMN public.invoices.ai_client_id IS 'portal.clients.id when the invoice is for an AI client (no portal account)';
COMMENT ON COLUMN public.invoices.recipient_email IS 'One-time invoice: typed recipient email (no user or AI client)';
COMMENT ON COLUMN public.invoices.recipient_name IS 'One-time invoice: optional recipient name';
