import crypto from "node:crypto";
import { mirrorFromStripe } from "@/libs/invoicing/core.mjs";
import { createStripeClient, getInvoice, invoicingMode } from "@/libs/invoicing/stripeInvoices.mjs";
import { listOpenInvoices, updateMirror } from "@/libs/db/invoices";

/** Daily: re-read every open hub invoice from Stripe and set overdue. Read-only against Stripe. Auth: Bearer CRON_SECRET. */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET || "";
  const got = String(req.headers.authorization || "");
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) return res.status(401).end();
  if (invoicingMode() === "none") return res.status(200).json({ checked: 0 });
  const stripe = createStripeClient();
  const rows = await listOpenInvoices();
  let overdue = 0, failed = 0;
  for (const r of rows) {
    try {
      const m = mirrorFromStripe(await getInvoice(stripe, r.stripe_invoice_id));
      if (!m) continue;
      await updateMirror(r.stripe_invoice_id, m);
      if (m.overdue) overdue++;
    } catch (e) { failed++; console.error("Overdue check failed", r.stripe_invoice_id, e?.message); }
  }
  return res.status(200).json({ checked: rows.length, overdue, failed });
}
