import { requireAdmin } from "@/libs/adminRequest";
import { publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";
import { NOT_MIGRATED_MESSAGE, approvalSignature, invoicingSchemaReady, loadClientInvoices, mirrorFromStripe, validateDraftInput } from "@/libs/invoicing/core.mjs";
import { createDraftInvoice, createStripeClient, ensureCustomer, invoicingMode, invoicingWritesAllowed, loadCatalog } from "@/libs/invoicing/stripeInvoices.mjs";
import { getClientBasic, getClientForInvoicing, insertInvoice, schemaProbes, listInvoicesForUser, saveStripeCustomerId, writeAudit } from "@/libs/db/invoices";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "POST"]);
  if (!session) return;
  const userId = String(req.query.id || "");

  if (req.method === "GET") {
    try {
      const { client, invoices, migrated } = await loadClientInvoices(userId, { getClient: getClientForInvoicing, getClientBasic, listInvoices: listInvoicesForUser });
      if (!client) return res.status(404).json({ error: "Not found", message: "Client not found" });
      return res.status(200).json({ success: true, data: { mode: invoicingMode(), migrated, notice: migrated ? null : NOT_MIGRATED_MESSAGE, client: { name: client.name, email: client.email }, invoices: invoices.map(publicInvoice) } });
    } catch (error) {
      console.error("List invoices error:", error?.message);
      return res.status(500).json({ error: "Server error", message: "Could not load invoices" });
    }
  }

  if (!(await invoicingSchemaReady(schemaProbes))) return res.status(503).json({ error: "Not migrated", message: NOT_MIGRATED_MESSAGE });
  const client = await getClientForInvoicing(userId);
  if (!client) return res.status(404).json({ error: "Not found", message: "Client not found" });

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
