import { requireAdmin } from "@/libs/adminRequest";
import { mirrorFromStripe } from "@/libs/invoicing/core.mjs";
import { createStripeClient, invoicingWritesAllowed, voidOrDiscard } from "@/libs/invoicing/stripeInvoices.mjs";
import { findInvoiceById, updateMirror, writeAudit } from "@/libs/db/invoices";
import { publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";

/** Void an open invoice (or discard a draft). Requires { confirm: "VOID" }. */
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;
  if (!invoicingWritesAllowed()) return res.status(403).json({ error: "Forbidden", message: "Invoicing is only enabled with a Stripe test key until live mode is approved." });
  if (req.body?.confirm !== "VOID") return res.status(400).json({ error: "Confirm required", message: "Confirm to void" });
  const row = await findInvoiceById(String(req.query.id || ""));
  if (!row) return res.status(404).json({ error: "Not found" });
  try {
    const result = await voidOrDiscard(createStripeClient(), row.stripe_invoice_id);
    const patch = result.status === "deleted" ? { status: "deleted", updated_at: new Date().toISOString() } : mirrorFromStripe(result);
    const updated = await updateMirror(row.stripe_invoice_id, patch);
    await writeAudit({ invoiceId: row.id, stripeInvoiceId: row.stripe_invoice_id, action: result.status === "deleted" ? "discard_draft" : "void", actorEmail: session.user.email, amountCents: result.total ?? row.total_cents, currency: result.currency || row.currency, livemode: result.livemode ?? row.livemode });
    return res.status(200).json({ success: true, data: { invoice: publicInvoice(updated || { ...row, ...patch }) } });
  } catch (error) {
    console.error("Void invoice error:", error?.message);
    return res.status(error?.status === 409 ? 409 : 502).json({ error: "Stripe error", message: error?.status === 409 ? error.message : "Could not void the invoice" });
  }
}
