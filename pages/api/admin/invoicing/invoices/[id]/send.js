import { requireAdmin } from "@/libs/adminRequest";
import { mirrorFromStripe, signatureFromStripeInvoice } from "@/libs/invoicing/core.mjs";
import { createStripeClient, finalizeAndSend, getInvoice, invoicingWritesAllowed } from "@/libs/invoicing/stripeInvoices.mjs";
import { findInvoiceById, getClientForInvoicing, updateMirror, writeAudit } from "@/libs/db/invoices";
import { publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";

const CONFIRM_WINDOW_MS = 5 * 60 * 1000;

/**
 * Finalize + send. Requires: admin session, confirmEmail equal to the client's email,
 * a fresh confirmation (confirmedAt within 5 minutes), and that Stripe's current
 * amounts still match what was approved. If they differ, returns 409 needs_reapproval
 * with the new total; the admin re-approves by sending { reapproveTotalCents } = that total.
 */
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;
  if (!invoicingWritesAllowed()) return res.status(403).json({ error: "Forbidden", message: "Invoicing is only enabled with a Stripe test key until live mode is approved." });
  const row = await findInvoiceById(String(req.query.id || ""));
  if (!row) return res.status(404).json({ error: "Not found" });
  const client = await getClientForInvoicing(row.user_id);
  const confirmedAt = Number(req.body?.confirmedAt);
  if (!client || String(req.body?.confirmEmail || "").toLowerCase() !== String(client.email).toLowerCase()) {
    return res.status(400).json({ error: "Confirm required", message: "Confirm the client's email to send" });
  }
  if (!Number.isFinite(confirmedAt) || Date.now() - confirmedAt > CONFIRM_WINDOW_MS || confirmedAt > Date.now() + 60000) {
    return res.status(400).json({ error: "Confirm expired", message: "Please confirm again" });
  }
  try {
    const stripe = createStripeClient();
    const current = await getInvoice(stripe, row.stripe_invoice_id);
    if (current.status !== "draft") {
      const synced = await updateMirror(row.stripe_invoice_id, mirrorFromStripe(current));
      return res.status(409).json({ error: "Already sent", message: `This invoice is already ${current.status}`, data: { invoice: publicInvoice(synced || row) } });
    }
    const sig = signatureFromStripeInvoice(current);
    const reapprove = req.body?.reapproveTotalCents;
    if (sig !== row.approved_signature || current.total !== Number(row.approved_total_cents)) {
      if (reapprove == null || Number(reapprove) !== current.total) {
        return res.status(409).json({ error: "needs_reapproval", message: "The amount changed since review. Review the new total and approve again.", data: { approvedTotalCents: Number(row.approved_total_cents), currentTotalCents: current.total } });
      }
      await updateMirror(row.stripe_invoice_id, { approved_total_cents: current.total, approved_signature: sig });
    }
    const sent = await finalizeAndSend(stripe, row.stripe_invoice_id);
    const updated = await updateMirror(row.stripe_invoice_id, { ...mirrorFromStripe(sent), sent_at: new Date().toISOString() });
    await writeAudit({ invoiceId: row.id, stripeInvoiceId: sent.id, action: "send", actorEmail: session.user.email, amountCents: sent.total, currency: sent.currency, livemode: sent.livemode });
    return res.status(200).json({ success: true, data: { invoice: publicInvoice(updated) } });
  } catch (error) {
    console.error("Send invoice error:", error?.message);
    return res.status(502).json({ error: "Stripe error", message: "Could not send the invoice" });
  }
}
