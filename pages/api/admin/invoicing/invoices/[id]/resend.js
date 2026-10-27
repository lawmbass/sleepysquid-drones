import { requireAdmin } from "@/libs/adminRequest";
import { mirrorFromStripe } from "@/libs/invoicing/core.mjs";
import { createStripeClient, invoicingWritesAllowed, resendInvoice } from "@/libs/invoicing/stripeInvoices.mjs";
import { findInvoiceById, updateMirror, writeAudit } from "@/libs/db/invoices";
import { publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";

/** Re-email an unpaid invoice. Body { confirm: "RESEND" }. One resend per invoice per minute (idempotency). */
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;
  if (!invoicingWritesAllowed()) return res.status(403).json({ error: "Forbidden", message: "Invoice writes are disabled." });
  if (req.body?.confirm !== "RESEND") return res.status(400).json({ error: "Confirm required", message: "Confirm to resend" });
  const row = await findInvoiceById(String(req.query.id || ""));
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.status !== "open") return res.status(409).json({ error: "Not unpaid", message: "Only unpaid invoices can be resent" });
  try {
    const inv = await resendInvoice(createStripeClient(), row.stripe_invoice_id, Math.floor(Date.now() / 60000));
    const updated = await updateMirror(row.stripe_invoice_id, mirrorFromStripe(inv));
    await writeAudit({ invoiceId: row.id, stripeInvoiceId: row.stripe_invoice_id, action: "resend", actorEmail: session.user.email, amountCents: inv.total, currency: inv.currency, livemode: inv.livemode });
    return res.status(200).json({ success: true, data: { invoice: publicInvoice(updated || row) } });
  } catch (error) {
    console.error("Resend invoice error:", error?.message);
    return res.status(error?.status === 409 ? 409 : 502).json({ error: "Stripe error", message: error?.status === 409 ? error.message : "Could not resend the invoice" });
  }
}
