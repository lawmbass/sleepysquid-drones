import { HANDLED_EVENTS, mirrorFromStripe, verifyStripeSignature } from "@/libs/invoicing/core.mjs";
import { findInvoiceByStripeId, updateMirror } from "@/libs/db/invoices";

export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Stripe webhook for hub invoices. Secret: STRIPE_INVOICING_WEBHOOK_SECRET.
 * Only invoices with metadata.source = sleepysquid-hub that already exist in the mirror
 * are updated, so Dispatch (same Stripe account) is ignored.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const raw = await readRaw(req);
  if (!verifyStripeSignature(raw, req.headers["stripe-signature"], process.env.STRIPE_INVOICING_WEBHOOK_SECRET)) {
    return res.status(400).json({ error: "Bad signature" });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: "Bad payload" }); }
  if (!HANDLED_EVENTS.includes(event.type)) return res.status(200).json({ received: true, ignored: true });
  const inv = event.data?.object;
  const mirror = mirrorFromStripe(inv);
  if (!mirror) return res.status(200).json({ received: true, ignored: true });
  try {
    const existing = await findInvoiceByStripeId(inv.id);
    if (!existing) return res.status(200).json({ received: true, ignored: true });
    const patch = { ...mirror };
    if (event.type === "invoice.payment_failed") patch.last_payment_error = inv.last_finalization_error?.message || "Payment failed";
    if (event.type === "invoice.paid") patch.last_payment_error = null;
    await updateMirror(inv.id, patch);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Invoice webhook error:", error?.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
