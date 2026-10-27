-- Allow 'delete' in the invoicing audit log (admins can remove void/draft invoices from the hub list).
ALTER TABLE public.invoice_audit_log DROP CONSTRAINT IF EXISTS invoice_audit_action_check;
ALTER TABLE public.invoice_audit_log ADD CONSTRAINT invoice_audit_action_check
  CHECK (action IN ('create_draft','send','void','discard_draft','delete'));
