import { requireAdmin } from "@/libs/adminRequest";
import { approvalSignature, deleteInvoiceFlow, idempotencyKey, mirrorFromStripe, validateDraftInput } from "@/libs/invoicing/core.mjs";
import { createStripeClient, getInvoice, invoicingWritesAllowed, loadCatalog, updateDraftInvoice } from "@/libs/invoicing/stripeInvoices.mjs";

import { deleteInvoiceRow, findInvoiceById, getClientBasic, listAuditForInvoice, updateMirror, writeAudit } from "@/libs/db/invoices";
import { publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";

/**
 * GET    detail: invoice, client, lines (from Stripe), timeline (mirror + audit), Stripe ids.
 * PATCH  edit a draft: { requestId, lines, memo, dueDate }.
 * DELETE { confirm: "DELETE" }: remove a void or draft invoice (any other status refused server-side).
 *        Drafts are deleted in Stripe too; void invoices stay in Stripe as a $0 voided record.
 */
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "PATCH", "DELETE"]);
  if (!session) return;
  const id = String(req.query.id || "");
  if (req.method === "GET") return detail(id, res);
  if (req.method === "PATCH") return edit(id, req, res, session);
  if (req.body?.confirm !== "DELETE") return res.status(400).json({ error: "Confirm required", message: "Confirm to delete" });
  try {
    const row = await findInvoiceById(id);
    const stripe = createStripeClient();
    const result = await deleteInvoiceFlow(row, {
      getStripeInvoice: (sid) => getInvoice(stripe, sid),
      deleteStripeDraft: (sid) => stripe.call("DELETE", `/invoices/${encodeURIComponent(sid)}`, undefined, { idempotency: idempotencyKey("delete", sid) }),
      deleteRow: deleteInvoiceRow,
      writeAudit,
      actorEmail: session.user.email,
      stripeWritesAllowed: invoicingWritesAllowed(),
    });
    if (!result.ok) return res.status(result.status).json({ error: "Cannot delete", message: result.message });
    return res.status(200).json({ success: true, data: { deleted: true, stripeDraftDeleted: result.stripeDraftDeleted } });
  } catch (error) {
    console.error("Delete invoice error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not delete the invoice" });
  }
}

async function detail(id, res) {
  try {
    const row = await findInvoiceById(id);
    if (!row || row.status === "deleted") return res.status(404).json({ error: "Not found" });
    const [client, audit] = await Promise.all([getClientBasic(row.user_id), listAuditForInvoice(row.stripe_invoice_id)]);
    let lines = null; let linesError = null;
    try {
      const inv = await getInvoice(createStripeClient(), row.stripe_invoice_id);
      lines = (inv.lines?.data || []).map((l) => ({ description: l.description, quantity: l.quantity || 1, amountCents: l.amount, unitAmountCents: l.price?.unit_amount ?? (l.quantity ? Math.round(l.amount / l.quantity) : l.amount), priceId: l.metadata?.list_price || l.price?.id || null, productId: typeof l.price?.product === "string" ? l.price.product : null }));
    } catch (e) { linesError = "Could not load lines from Stripe"; }
    const timeline = [
      { at: row.created_at, label: "Created" },
      ...audit.map((a) => ({ at: a.created_at, label: { create_draft: "Draft saved", send: "Sent", void: "Voided", discard_draft: "Draft discarded", delete: "Deleted", edit_draft: "Draft edited", resend: "Resent" }[a.action] || a.action, by: a.actor_email })),
      row.paid_at && { at: row.paid_at, label: "Paid" },
      row.last_payment_error && { at: row.stripe_updated_at, label: `Payment failed: ${row.last_payment_error}` },
    ].filter(Boolean).sort((a, b) => new Date(a.at) - new Date(b.at));
    return res.status(200).json({ success: true, data: {
      invoice: publicInvoice(row), client: client ? { id: row.user_id, name: client.name, email: client.email } : null,
      lines, linesError, timeline, stripe: { invoiceId: row.stripe_invoice_id, customerId: row.stripe_customer_id },
    } });
  } catch (error) {
    console.error("Invoice detail error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not load the invoice" });
  }
}

async function edit(id, req, res, session) {
  if (!invoicingWritesAllowed()) return res.status(403).json({ error: "Forbidden", message: "Invoice writes are disabled." });
  const requestId = String(req.body?.requestId || "");
  if (!/^[A-Za-z0-9-]{16,64}$/.test(requestId)) return res.status(400).json({ error: "Invalid request", message: "Missing request id" });
  const row = await findInvoiceById(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.status !== "draft") return res.status(409).json({ error: "Not a draft", message: "Only drafts can be edited" });
  try {
    const stripe = createStripeClient();
    const parsed = validateDraftInput(req.body, await loadCatalog(stripe));
    if (!parsed.ok) return res.status(400).json({ error: "Invalid invoice", message: Object.values(parsed.errors)[0], fields: parsed.errors });
    const inv = await updateDraftInvoice(stripe, row.stripe_invoice_id, { draft: parsed.value, requestId });
    const updated = await updateMirror(row.stripe_invoice_id, { ...mirrorFromStripe(inv), approved_total_cents: parsed.value.totalCents, approved_signature: approvalSignature(parsed.value) });
    await writeAudit({ invoiceId: row.id, stripeInvoiceId: row.stripe_invoice_id, action: "edit_draft", actorEmail: session.user.email, amountCents: inv.total, currency: inv.currency, livemode: inv.livemode });
    return res.status(200).json({ success: true, data: { invoice: publicInvoice(updated || row) } });
  } catch (error) {
    console.error("Edit invoice error:", error?.message);
    return res.status(error?.status === 409 ? 409 : 502).json({ error: "Stripe error", message: error?.status === 409 ? error.message : "Stripe couldn't save the draft. Your changes are kept; try again." });
  }
}
