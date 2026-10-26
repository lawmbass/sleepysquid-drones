/**
 * Server-only Stripe calls for hub invoicing. Never import from a component.
 * Key: STRIPE_INVOICING_SECRET_KEY (falls back to STRIPE_SECRET_KEY).
 * Writes run with a test key, or with a live key only when INVOICING_LIVE_ENABLED=true.
 * The Stripe API version is pinned so `price` / `price_data` on invoice items behave predictably.
 */
import { INVOICE_SOURCE, buildCatalog, idempotencyKey, keyMode, writesAllowed } from "./core.mjs";

const API = "https://api.stripe.com/v1";
export const STRIPE_VERSION = "2024-06-20";

export class InvoicingError extends Error {
  constructor(message, { status = 502, code = null } = {}) { super(message); this.status = status; this.code = code; }
}

export function invoicingKey(env = process.env) {
  return env.STRIPE_INVOICING_SECRET_KEY || env.STRIPE_SECRET_KEY || "";
}
export function invoicingMode(env = process.env) { return keyMode(invoicingKey(env)); }
export function invoicingWritesAllowed(env = process.env) { return writesAllowed(invoicingKey(env), env); }

export function encodeForm(params, prefix = "", out = []) {
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") encodeForm(item, `${name}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${name}[]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof value === "object") encodeForm(value, name, out);
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  return out;
}

export function createStripeClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const key = invoicingKey(env);
  async function call(method, path, params, { idempotency } = {}) {
    if (!key) throw new InvoicingError("Stripe is not configured", { status: 503 });
    if (method !== "GET" && !writesAllowed(key, env)) throw new InvoicingError("Invoice writes are disabled for this Stripe key", { status: 403, code: "writes_disabled" });
    const query = encodeForm(params).join("&");
    const url = method === "GET" && query ? `${API}${path}?${query}` : `${API}${path}`;
    const headers = { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION };
    if (method !== "GET") headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotency) headers["Idempotency-Key"] = idempotency;
    const res = await fetchImpl(url, { method, headers, body: method === "GET" ? undefined : query });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Stripe invoicing request failed", method, path, res.status, body?.error?.type, body?.error?.code);
      throw new InvoicingError(body?.error?.code === "resource_missing" ? "Not found in Stripe" : "Stripe request failed", { status: res.status === 404 ? 404 : 502, code: body?.error?.code || null });
    }
    return body;
  }
  async function listAll(path, params = {}, max = 1000) {
    const rows = []; let after;
    for (;;) {
      const page = await call("GET", path, { limit: 100, ...params, starting_after: after });
      rows.push(...(page.data || []));
      if (!page.has_more || rows.length >= max || !page.data?.length) break;
      after = page.data[page.data.length - 1].id;
    }
    return rows;
  }
  return { call, listAll, mode: keyMode(key) };
}

/** Catalog of hub products (metadata.service = drones|ai|web, Dispatch excluded) with their existing one-time Prices. */
export async function loadCatalog(client) {
  const [products, prices] = await Promise.all([
    client.listAll("/products", { active: true }),
    client.listAll("/prices", { active: true, type: "one_time" }),
  ]);
  return buildCatalog(products, prices);
}

/** Reuse the saved customer, or create one (idempotent per user). Never touches non-hub customers. */
export async function ensureCustomer(client, user) {
  if (user.stripeCustomerId) {
    const c = await client.call("GET", `/customers/${encodeURIComponent(user.stripeCustomerId)}`);
    if (!c.deleted) return c.id;
  }
  const c = await client.call("POST", "/customers", {
    email: user.email, name: user.name || user.company || undefined,
    metadata: { source: INVOICE_SOURCE, hub_user_id: user.id },
  }, { idempotency: idempotencyKey("customer", user.id, client.mode) });
  return c.id;
}

/** Create a DRAFT invoice + invoice items. auto_advance=false so nothing is sent until an admin clicks Send. */
export async function createDraftInvoice(client, { customerId, user, draft, requestId }) {
  const businessLines = [...new Set(draft.lines.map((l) => l.businessLine))].join(",");
  const invoice = await client.call("POST", "/invoices", {
    customer: customerId,
    collection_method: "send_invoice",
    due_date: draft.dueTimestamp,
    auto_advance: false,
    pending_invoice_items_behavior: "exclude",
    description: draft.memo || undefined,
    currency: draft.currency,
    metadata: { source: INVOICE_SOURCE, business_lines: businessLines, hub_user_id: user.id },
  }, { idempotency: idempotencyKey("invoice", requestId) });
  for (let i = 0; i < draft.lines.length; i++) {
    const l = draft.lines[i];
    const item = l.amountCents === l.listAmountCents
      ? { price: l.priceId }
      : { price_data: { product: l.productId, currency: draft.currency, unit_amount: l.amountCents } };
    await client.call("POST", "/invoiceitems", {
      customer: customerId, invoice: invoice.id, description: l.description, ...item,
      metadata: { source: INVOICE_SOURCE, business_line: l.businessLine, list_price: l.priceId },
    }, { idempotency: idempotencyKey("item", requestId, i) });
  }
  return client.call("GET", `/invoices/${invoice.id}`);
}

export const getInvoice = (client, id) => client.call("GET", `/invoices/${encodeURIComponent(id)}`);

export async function finalizeAndSend(client, id) {
  const inv = await getInvoice(client, id);
  if (inv.status === "draft") await client.call("POST", `/invoices/${id}/finalize`, { auto_advance: false }, { idempotency: idempotencyKey("finalize", id) });
  await client.call("POST", `/invoices/${id}/send`, {}, { idempotency: idempotencyKey("send", id) });
  return getInvoice(client, id);
}

export async function voidOrDiscard(client, id) {
  const inv = await getInvoice(client, id);
  if (inv.status === "draft") {
    await client.call("DELETE", `/invoices/${id}`, undefined, { idempotency: idempotencyKey("delete", id) });
    return { ...inv, status: "deleted" };
  }
  if (inv.status !== "open" && inv.status !== "uncollectible") throw new InvoicingError(`Cannot void an invoice that is ${inv.status}`, { status: 409 });
  return client.call("POST", `/invoices/${id}/void`, {}, { idempotency: idempotencyKey("void", id) });
}
