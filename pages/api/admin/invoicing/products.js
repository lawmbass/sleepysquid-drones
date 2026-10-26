import { requireAdmin } from "@/libs/adminRequest";
import { createStripeClient, invoicingMode, invoicingWritesAllowed, loadCatalog } from "@/libs/invoicing/stripeInvoices.mjs";
import { defaultDueDate } from "@/libs/invoicing/core.mjs";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET"]);
  if (!session) return;
  const mode = invoicingMode();
  if (mode === "none") return res.status(200).json({ success: true, data: { mode, writesAllowed: false, products: [], defaultDueDate: defaultDueDate() } });
  try {
    const products = await loadCatalog(createStripeClient());
    return res.status(200).json({ success: true, data: { mode, writesAllowed: invoicingWritesAllowed(), products, defaultDueDate: defaultDueDate() } });
  } catch (error) {
    console.error("Invoicing catalog error:", error?.message);
    return res.status(502).json({ error: "Stripe unavailable", message: "Could not load products" });
  }
}
