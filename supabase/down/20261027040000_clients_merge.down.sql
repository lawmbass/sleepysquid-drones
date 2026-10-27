-- Down path for 20261027040000_clients_merge.sql. Restores user_id / ai_client_id on invoices from client_id
-- (for invoices created after the merge), then drops client_id and public.clients.
-- Clients with neither a login nor an AI client (created after the merge) have no old home: their invoices become
-- one-time invoices to the client's email. Fails (rolls back) if such a client has no email.
BEGIN;
DROP TRIGGER IF EXISTS invoices_legacy_recipient_readonly ON public.invoices;
DROP FUNCTION IF EXISTS public.invoices_legacy_recipient_readonly();
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_client_check;
UPDATE public.invoices i SET user_id = c.user_id FROM public.clients c
  WHERE i.client_id = c.id AND i.user_id IS NULL AND i.ai_client_id IS NULL AND c.user_id IS NOT NULL;
UPDATE public.invoices i SET ai_client_id = c.portal_client_id FROM public.clients c
  WHERE i.client_id = c.id AND i.user_id IS NULL AND i.ai_client_id IS NULL AND c.portal_client_id IS NOT NULL;
UPDATE public.invoices i SET recipient_email = c.email, recipient_name = coalesce(i.recipient_name, c.business_name) FROM public.clients c
  WHERE i.client_id = c.id AND i.user_id IS NULL AND i.ai_client_id IS NULL AND i.recipient_email IS NULL;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_recipient_check
  CHECK (user_id IS NOT NULL OR ai_client_id IS NOT NULL OR recipient_email IS NOT NULL);
DROP INDEX IF EXISTS public.invoices_client_id_idx;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS client_id;
DROP TABLE IF EXISTS public.clients;
COMMIT;
