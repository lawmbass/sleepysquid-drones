/**
 * Pure invoicing helpers (no I/O) so they can be unit-tested with node --test.
 * Hub products are Stripe Products tagged metadata.service = drones | ai | web (the existing
 * hub tag; "web" is shown as the Website line in the UI). Dispatch products are always excluded.
 * Anything else (including Dispatch) is ignored entirely.
 */
import crypto from "node:crypto";

export const BUSINESS_LINES = ["drones", "ai", "web"];
export const INVOICE_SOURCE = "sleepysquid-hub";
export const DEFAULT_DUE_DAYS = 14;
export const MAX_LINES = 25;
export const MAX_LINE_CENTS = 5_000_000; // $50,000 per line guardrail
export const HANDLED_EVENTS = [
  "invoice.finalized",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.marked_uncollectible",
  "invoice.voided",
];

export function keyMode(key) {
  if (/^(sk|rk)_test_/.test(key || "")) return "test";
  if (/^(sk|rk)_live_/.test(key || "")) return "live";
  return "none";
}

/** Live writes need INVOICING_LIVE_ENABLED=true on top of a live key. Test keys always may write. */
export function writesAllowed(key, env = {}) {
  const mode = keyMode(key);
  if (mode === "test") return true;
  if (mode === "live") return env.INVOICING_LIVE_ENABLED === "true";
  return false;
}

export function productBusinessLine(product) {
  const tag = String(product?.metadata?.service || "").trim().toLowerCase();
  if (/dispatch/i.test(String(product?.name || ""))) return null; // never offer Dispatch products
  return BUSINESS_LINES.includes(tag) ? tag : null;
}

/** products: Stripe products (with prices expanded separately). prices: Stripe prices list. */
export function buildCatalog(products, prices) {
  const byProduct = new Map();
  for (const p of products || []) {
    if (!p?.active) continue;
    const line = productBusinessLine(p);
    if (!line) continue;
    byProduct.set(p.id, { productId: p.id, name: p.name, businessLine: line, prices: [] });
  }
  for (const price of prices || []) {
    if (!price?.active) continue;
    const productId = typeof price.product === "string" ? price.product : price.product?.id;
    const entry = byProduct.get(productId);
    if (!entry) continue;
    if (price.type !== "one_time" || !Number.isInteger(price.unit_amount)) continue;
    entry.prices.push({
      priceId: price.id,
      unitAmount: price.unit_amount,
      currency: price.currency,
      nickname: price.nickname || null,
    });
  }
  return [...byProduct.values()]
    .filter((e) => e.prices.length > 0)
    .sort((a, b) => a.businessLine.localeCompare(b.businessLine) || a.name.localeCompare(b.name));
}

export function defaultDueDate(now = new Date()) {
  const d = new Date(now.getTime() + DEFAULT_DUE_DAYS * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Validate a draft request against the live catalog. Returns { ok, value | errors }. */
export function validateDraftInput(body, catalog, now = new Date()) {
  const errors = {};
  const priceIndex = new Map();
  for (const p of catalog) for (const pr of p.prices) priceIndex.set(pr.priceId, { ...pr, product: p });
  const rawLines = Array.isArray(body?.lines) ? body.lines : [];
  if (rawLines.length === 0) errors.lines = "Add at least one line";
  if (rawLines.length > MAX_LINES) errors.lines = `At most ${MAX_LINES} lines`;
  const lines = [];
  let currency = null;
  rawLines.slice(0, MAX_LINES).forEach((l, i) => {
    const hit = priceIndex.get(String(l?.priceId || ""));
    if (!hit) { errors[`lines.${i}`] = "Pick a Drones, AI or Website product"; return; }
    const cents = Math.round(Number(l?.amountCents ?? hit.unitAmount));
    if (!Number.isInteger(cents) || cents < 1 || cents > MAX_LINE_CENTS) { errors[`lines.${i}`] = "Amount must be between $0.01 and $50,000"; return; }
    if (currency && currency !== hit.currency) { errors[`lines.${i}`] = "All lines must use one currency"; return; }
    currency = hit.currency;
    const description = String(l?.description || "").trim().slice(0, 200) || hit.product.name;
    lines.push({ priceId: hit.priceId, productId: hit.product.productId, businessLine: hit.product.businessLine, amountCents: cents, listAmountCents: hit.unitAmount, description });
  });
  const memo = String(body?.memo || "").trim().slice(0, 500);
  const due = String(body?.dueDate || defaultDueDate(now));
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(due) ? new Date(`${due}T23:59:59Z`) : null;
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  if (!dueDate || Number.isNaN(dueDate.getTime()) || dueDate < today) errors.dueDate = "Due date must be today or later";
  else if (dueDate.getTime() - now.getTime() > 366 * 86400000) errors.dueDate = "Due date must be within a year";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { lines, memo, dueDate: due, dueTimestamp: Math.floor(dueDate.getTime() / 1000), currency, totalCents: lines.reduce((s, l) => s + l.amountCents, 0) } };
}

/** Signature of what the admin reviewed: per-line amounts + total + currency + due date. */
export function approvalSignature({ lines, totalCents, currency, dueTimestamp }) {
  const canon = JSON.stringify({ l: (lines || []).map((l) => [l.amountCents, l.description || ""]), t: totalCents, c: currency, d: dueTimestamp || null });
  return crypto.createHash("sha256").update(canon).digest("hex");
}

/** Same signature computed from the Stripe invoice object (source of truth at send time). */
export function signatureFromStripeInvoice(inv) {
  const lines = (inv?.lines?.data || []).map((l) => ({ amountCents: l.amount, description: l.description || "" }));
  return approvalSignature({ lines, totalCents: inv?.total, currency: inv?.currency, dueTimestamp: inv?.due_date || null });
}

export function displayStatus(row, now = new Date()) {
  if (!row) return "unknown";
  if (row.status === "open") {
    const due = row.due_date ? new Date(row.due_date) : null;
    return row.overdue || (due && due < now) ? "overdue" : "open";
  }
  return row.status;
}

/** Map a Stripe invoice to mirror-table columns. Returns null for invoices that are not ours. */
export function mirrorFromStripe(inv, now = new Date()) {
  if (!inv || inv.object !== "invoice") return null;
  if (inv.metadata?.source !== INVOICE_SOURCE) return null;
  const lines = String(inv.metadata?.business_lines || "").split(",").filter((l) => BUSINESS_LINES.includes(l));
  const due = inv.due_date ? new Date(inv.due_date * 1000) : null;
  const t = inv.status_transitions || {};
  return {
    stripe_invoice_id: inv.id,
    stripe_customer_id: typeof inv.customer === "string" ? inv.customer : inv.customer?.id,
    livemode: Boolean(inv.livemode),
    status: inv.status || "draft",
    overdue: inv.status === "open" && Boolean(due && due < now),
    business_lines: lines,
    currency: inv.currency || "usd",
    total_cents: inv.total ?? 0,
    amount_due_cents: inv.amount_due ?? 0,
    amount_paid_cents: inv.amount_paid ?? 0,
    due_date: due ? due.toISOString() : null,
    memo: inv.description || null,
    number: inv.number || null,
    hosted_invoice_url: inv.hosted_invoice_url || null,
    invoice_pdf: inv.invoice_pdf || null,
    paid_at: t.paid_at ? new Date(t.paid_at * 1000).toISOString() : null,
    voided_at: t.voided_at ? new Date(t.voided_at * 1000).toISOString() : null,
    stripe_updated_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/** Verify a Stripe-Signature header (v1, HMAC-SHA256) with a tolerance in seconds. */
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  let ts = null; const sigs = [];
  for (const piece of String(header).split(",")) {
    const [k, v] = piece.split("=");
    if (k === "t") ts = Number(v);
    if (k === "v1" && v) sigs.push(v);
  }
  if (!Number.isFinite(ts) || sigs.length === 0) return false;
  if (Math.abs(nowSec - ts) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const exp = Buffer.from(expected, "hex");
  return sigs.some((s) => { const b = Buffer.from(s, "hex"); return b.length === exp.length && crypto.timingSafeEqual(b, exp); });
}

export function idempotencyKey(...parts) {
  return crypto.createHash("sha256").update(parts.map(String).join("|")).digest("hex").slice(0, 48);
}

/**
 * True when a database error means the invoicing migration has not been applied yet
 * (missing users.stripe_customer_id column or missing invoices / invoice_audit_log tables).
 * Covers Postgres codes and PostgREST schema-cache codes.
 */
export function isMissingSchemaError(error) {
  const code = String(error?.code || "");
  if (["42703", "42P01", "PGRST204", "PGRST205"].includes(code)) return true;
  const msg = String(error?.message || "");
  return /stripe_customer_id|invoice_audit_log|relation "?(public\.)?invoices"?|table '?(public\.)?invoices'?/i.test(msg)
    && /does not exist|could not find|schema cache/i.test(msg);
}

export const NOT_MIGRATED_MESSAGE = "Invoicing database tables are not set up yet (migration 20261026210000_invoicing.sql has not been applied). Drafts can't be saved until it is.";

/**
 * Loads a client's invoice list without failing when the migration is missing.
 * deps: { getClient(id) -> client|null, getClientBasic(id) -> client|null, listInvoices(userId) -> rows }
 * Returns { client, invoices, migrated }.
 */
export async function loadClientInvoices(userId, deps) {
  let client;
  let migrated = true;
  try {
    client = await deps.getClient(userId);
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    migrated = false;
    client = await deps.getClientBasic(userId);
  }
  if (!client) return { client: null, invoices: [], migrated };
  if (!migrated) return { client, invoices: [], migrated };
  try {
    return { client, invoices: await deps.listInvoices(client.id), migrated: true };
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    return { client, invoices: [], migrated: false };
  }
}

/** Probes the schema; resolves true only when every probe succeeds. Rethrows unrelated errors. */
export async function invoicingSchemaReady(probes) {
  for (const probe of probes) {
    try { await probe(); } catch (error) { if (isMissingSchemaError(error)) return false; throw error; }
  }
  return true;
}

export const STATUS_FILTERS = ["all", "draft", "open", "paid", "overdue", "void", "uncollectible"];

/** Filters public invoices by display status and business line (metadata.service value). */
export function filterInvoices(invoices, { status = "all", line = "all" } = {}) {
  return (invoices || []).filter((inv) =>
    inv.status !== "deleted"
    && (status === "all" || inv.status === status)
    && (line === "all" || (inv.businessLines || []).includes(line)));
}
