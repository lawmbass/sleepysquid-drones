-- Allow 'edit_draft' and 'resend' in the invoicing audit log (one-screen composer + list quick actions).
ALTER TABLE public.invoice_audit_log DROP CONSTRAINT IF EXISTS invoice_audit_action_check;
ALTER TABLE public.invoice_audit_log ADD CONSTRAINT invoice_audit_action_check
  CHECK (action IN ('create_draft','send','void','discard_draft','delete','edit_draft','resend'));
