import { assertNoError, db, isUuid } from "@/libs/db/shared";

const COLS = "*";

export async function getClientForInvoicing(userId) {
  if (!isUuid(userId)) return null;
  const { data, error } = await db().from("users").select("id,name,email,company,stripe_customer_id").eq("id", userId).maybeSingle();
  assertNoError(error);
  return data ? { id: data.id, name: data.name, email: data.email, company: data.company, stripeCustomerId: data.stripe_customer_id } : null;
}

/** Client lookup that works before the invoicing migration (no stripe_customer_id column). */
export async function getClientBasic(userId) {
  if (!isUuid(userId)) return null;
  const { data, error } = await db().from("users").select("id,name,email,company").eq("id", userId).maybeSingle();
  assertNoError(error);
  return data ? { id: data.id, name: data.name, email: data.email, company: data.company, stripeCustomerId: null } : null;
}

/** Zero-row probes used to check the invoicing migration has been applied. */
export const schemaProbes = [
  async () => { const { error } = await db().from("users").select("stripe_customer_id").limit(1); assertNoError(error); },
  async () => { const { error } = await db().from("invoices").select("id").limit(1); assertNoError(error); },
  async () => { const { error } = await db().from("invoice_audit_log").select("id").limit(1); assertNoError(error); },
];

export async function saveStripeCustomerId(userId, customerId) {
  const { error } = await db().from("users").update({ stripe_customer_id: customerId }).eq("id", userId);
  assertNoError(error);
}

export async function listInvoicesForUser(userId) {
  const { data, error } = await db().from("invoices").select(COLS).eq("user_id", userId).neq("status", "deleted").order("created_at", { ascending: false }).limit(100);
  assertNoError(error);
  return data || [];
}

/** All hub invoices with their client, newest first (admin Invoices section). */
export async function listAllInvoices(limit = 500) {
  const { data, error } = await db().from("invoices").select("*, client:users!invoices_user_id_fkey(id,name,email,company)").neq("status", "deleted").order("created_at", { ascending: false }).limit(limit);
  assertNoError(error);
  return data || [];
}

export async function findInvoiceByStripeId(stripeInvoiceId) {
  const { data, error } = await db().from("invoices").select(COLS).eq("stripe_invoice_id", stripeInvoiceId).maybeSingle();
  assertNoError(error);
  return data;
}

export async function findInvoiceById(id) {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("invoices").select(COLS).eq("id", id).maybeSingle();
  assertNoError(error);
  return data;
}

export async function insertInvoice(row) {
  const { data, error } = await db().from("invoices").upsert(row, { onConflict: "stripe_invoice_id" }).select(COLS).single();
  assertNoError(error);
  return data;
}

/** Update mirror columns from Stripe. Only touches rows we created (matched by stripe_invoice_id). */
export async function updateMirror(stripeInvoiceId, patch) {
  const { data, error } = await db().from("invoices").update(patch).eq("stripe_invoice_id", stripeInvoiceId).select(COLS).maybeSingle();
  assertNoError(error);
  return data;
}

export async function listOpenInvoices() {
  const { data, error } = await db().from("invoices").select("stripe_invoice_id,due_date,overdue").eq("status", "open").limit(1000);
  assertNoError(error);
  return data || [];
}

export async function writeAudit({ invoiceId, stripeInvoiceId, action, actorEmail, amountCents, currency, livemode }) {
  const { error } = await db().from("invoice_audit_log").insert({
    invoice_id: invoiceId || null, stripe_invoice_id: stripeInvoiceId, action,
    actor_email: String(actorEmail || "").toLowerCase(), amount_cents: amountCents ?? 0, currency: currency || "usd", livemode: Boolean(livemode),
  });
  assertNoError(error);
}

export async function deleteInvoiceRow(id) {
  if (!isUuid(id)) return;
  const { error } = await db().from("invoices").delete().eq("id", id);
  assertNoError(error);
}

export async function listAuditForInvoice(stripeInvoiceId) {
  const { data, error } = await db().from("invoice_audit_log").select("action,actor_email,amount_cents,currency,created_at").eq("stripe_invoice_id", stripeInvoiceId).order("created_at", { ascending: true }).limit(100);
  assertNoError(error);
  return data || [];
}
