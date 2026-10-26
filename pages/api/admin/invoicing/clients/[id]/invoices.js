import { requireAdmin } from "@/libs/adminRequest";
import { publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";
import { approvalSignature, mirrorFromStripe, validateDraftInput } from "@/libs/invoicing/core.mjs";
import { createDraftInvoice, createStripeClient, ensureCustomer, invoicingMode, invoicingWritesAllowed, loadCatalog } from "@/libs/invoicing/stripeInvoices.mjs";
import { getClientForInvoicing, insertInvoice, listInvoicesForUser, saveStripeCustomerId, writeAudit } from "@/libs/db/invoices";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "POST"]);
  if (!session) return;
  const client = await getClientForInvoicing(String(req.query.id || ""));
  if (!client) return res.status(404).json({ error: "Not found", message: "Client not found" });

  if (req.method === "GET") {
    const rows = await listInvoicesForUser(client.id);
    return res.status(200).json({ success: true, data: { mode: invoicingMode(), client: { name: client.name, email: client.email }, invoices: rows.map(publicInvoice) } });
  }

  if (!invoicingWritesAllowed()) return res.status(403).json({ error: "Forbidden", message: "Invoicing is only enabled with a Stripe test key until live mode is approved." });
  const requestId = String(req.body?.requestId || "");
  if (!/^[A-Za-z0-9-]{16,64}$/.test(requestId)) return res.status(400).json({ error: "Invalid request", message: "Missing request id" });
  try {
    const stripe = createStripeClient();
    const catalog = await loadCatalog(stripe);
    const parsed = validateDraftInput(req.body, catalog);
    if (!parsed.ok) return res.status(400).json({ error: "Invalid invoice", message: Object.values(parsed.errors)[0], fields: parsed.errors });
    const customerId = await ensureCustomer(stripe, client);
    if (customerId !== client.stripeCustomerId) await saveStripeCustomerId(client.id, customerId);
    const inv = await createDraftInvoice(stripe, { customerId, user: client, draft: parsed.value, requestId });
    const mirror = mirrorFromStripe(inv);
    const row = await insertInvoice({
      ...mirror, user_id: client.id, created_by: session.user.email.toLowerCase(),
      approved_total_cents: parsed.value.totalCents,
      approved_signature: approvalSignature(parsed.value),
    });
    await writeAudit({ invoiceId: row.id, stripeInvoiceId: inv.id, action: "create_draft", actorEmail: session.user.email, amountCents: inv.total, currency: inv.currency, livemode: inv.livemode });
    // If Stripe's draft total differs from what the admin reviewed, the send step will demand re-approval.
    return res.status(201).json({ success: true, data: { invoice: publicInvoice(row), matchesReview: inv.total === parsed.value.totalCents } });
  } catch (error) {
    console.error("Create invoice error:", error?.message);
    return res.status(error?.status && error.status < 500 ? error.status : 502).json({ error: "Stripe error", message: "Could not create the draft invoice" });
  }
}
