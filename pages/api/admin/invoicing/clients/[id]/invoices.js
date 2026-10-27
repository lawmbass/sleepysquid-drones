import { requireAdmin } from "@/libs/adminRequest";
import { publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";
import { NOT_MIGRATED_MESSAGE, approvalSignature, invoicingSchemaReady, loadClientInvoices, mirrorFromStripe, validateDraftInput } from "@/libs/invoicing/core.mjs";
import { createDraftInvoice, createStripeClient, ensureCustomer, ensureCustomerByEmail, invoicingMode, invoicingWritesAllowed, loadCatalog } from "@/libs/invoicing/stripeInvoices.mjs";
import { getInvoiceableRecipient, getRecipient } from "@/libs/invoicing/recipients";
import { listInvoicesForClient, updateClient } from "@/libs/db/clients";
import { parseRecipientRef } from "@/libs/invoicing/ui.mjs";
import { getClientBasic, insertInvoice, schemaProbes, listInvoicesForUser, listInvoicesForAiClient, listInvoicesForEmail, saveStripeCustomerId, writeAudit } from "@/libs/db/invoices";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "POST"]);
  if (!session) return;
  // id is a users.id (portal client account) or "ai:<portal client id>" (AI client, no account).
  const ref = String(req.query.id || "");
  const parsedRef = parseRecipientRef(ref);
  if (!parsedRef) return res.status(404).json({ error: "Not found", message: "Client not found" });

  if (req.method === "GET") {
    try {
      // After the clients merge, user/AI refs resolve to a client row, whose invoices are keyed by client_id.
      const resolved = parsedRef.kind === "email" ? null : await getRecipient(ref);
      const { client, invoices, migrated } = await loadClientInvoices(ref, resolved?.kind === "client"
        ? { getClient: getRecipient, getClientBasic: getRecipient, listInvoices: () => listInvoicesForClient(resolved.clientId) }
        : parsedRef.kind === "ai"
        ? { getClient: getRecipient, getClientBasic: getRecipient, listInvoices: () => listInvoicesForAiClient(parsedRef.id) }
        : parsedRef.kind === "email"
        ? { getClient: getRecipient, getClientBasic: getRecipient, listInvoices: () => listInvoicesForEmail(parsedRef.id) }
        : { getClient: getRecipient, getClientBasic, listInvoices: listInvoicesForUser });
      if (!client) return res.status(404).json({ error: "Not found", message: "Client not found" });
      return res.status(200).json({ success: true, data: { mode: invoicingMode(), migrated, notice: migrated ? null : NOT_MIGRATED_MESSAGE, client: { id: client.id, name: client.name, email: client.email, kind: client.kind || "user" }, invoices: invoices.map(publicInvoice) } });
    } catch (error) {
      console.error("List invoices error:", error?.message);
      return res.status(500).json({ error: "Server error", message: "Could not load invoices" });
    }
  }

  if (!(await invoicingSchemaReady(schemaProbes))) return res.status(503).json({ error: "Not migrated", message: NOT_MIGRATED_MESSAGE });
  const { recipient: client, refusal } = await getInvoiceableRecipient(ref);
  if (!client) return res.status(404).json({ error: "Not found", message: "Client not found" });
  if (refusal) return res.status(400).json({ error: "Invalid recipient", message: refusal });
  if (client.archived) return res.status(400).json({ error: "Invalid recipient", message: "This client is archived" });

  if (!invoicingWritesAllowed()) return res.status(403).json({ error: "Forbidden", message: "Invoicing is only enabled with a Stripe test key until live mode is approved." });
  const requestId = String(req.body?.requestId || "");
  if (!/^[A-Za-z0-9-]{16,64}$/.test(requestId)) return res.status(400).json({ error: "Invalid request", message: "Missing request id" });
  try {
    const stripe = createStripeClient();
    const catalog = await loadCatalog(stripe);
    const parsed = validateDraftInput(req.body, catalog);
    if (!parsed.ok) return res.status(400).json({ error: "Invalid invoice", message: Object.values(parsed.errors)[0], fields: parsed.errors });
    let customerId;
    const recipientName = client.kind === "email" ? String(req.body?.recipientName || "").trim().slice(0, 120) || null : null;
    if (client.kind === "email") client.name = recipientName;
    if (client.kind === "client") {
      customerId = client.stripeCustomerId || await ensureCustomerByEmail(stripe, { email: client.email, name: client.company, clientId: client.clientId });
      if (customerId !== client.stripeCustomerId) await updateClient(client.clientId, { stripe_customer_id: customerId });
    } else if (client.kind !== "user") customerId = await ensureCustomerByEmail(stripe, { email: client.email, name: client.name, aiClientId: client.aiClientId });
    else {
      customerId = await ensureCustomer(stripe, client);
      if (customerId !== client.stripeCustomerId) await saveStripeCustomerId(client.userId, customerId);
    }
    const inv = await createDraftInvoice(stripe, { customerId, user: client, draft: parsed.value, requestId });
    const mirror = mirrorFromStripe(inv);
    const row = await insertInvoice({
      ...mirror, ...(client.kind === "client" ? { client_id: client.clientId } : { user_id: client.userId, ai_client_id: client.aiClientId }),
      ...(client.kind === "email" ? { recipient_email: client.email, recipient_name: recipientName } : {}), created_by: session.user.email.toLowerCase(),
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
