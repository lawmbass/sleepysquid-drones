-- Fix for 20261026210000_invoicing.sql: on production the server role got
-- "permission denied for table invoices" because the new tables had no grants
-- for service_role. Server-only access stays: anon/authenticated remain revoked.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.invoice_audit_log_id_seq TO service_role;
