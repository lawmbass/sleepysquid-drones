/** Browser-safe invoicing helpers (no node: imports). Re-exported from core.mjs. */
const DEFAULT_DUE_DAYS = 14;

export const STATUS_FILTERS = ["all", "unpaid", "draft", "open", "paid", "overdue", "void", "uncollectible"];

/** Filters public invoices by display status and business line (metadata.service value). */
export function filterInvoices(invoices, { status = "all", line = "all" } = {}) {
  return (invoices || []).filter((inv) =>
    inv.status !== "deleted"
    && (status === "all" || inv.status === status || (status === "unpaid" && (inv.status === "open" || inv.status === "overdue")))
    && (line === "all" || (inv.businessLines || []).includes(line)));
}

/* ---------- List UX helpers ---------- */
export const LIST_CHIPS = ["all", "unpaid", "overdue", "paid", "draft"];
export const CHIP_LABEL = { all: "All", unpaid: "Unpaid", overdue: "Overdue", paid: "Paid", draft: "Drafts" };
/** Display chip for a row: Draft / Unpaid / Overdue / Paid / Void (open + past due = Overdue). */
export const STATUS_CHIP_LABEL = { draft: "Draft", open: "Unpaid", overdue: "Overdue", paid: "Paid", void: "Void", uncollectible: "Uncollectible" };

export function daysOverdue(inv, now = new Date()) {
  if (!inv || inv.status !== "overdue" || !inv.dueDate) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000));
}

export function matchesClientSearch(inv, q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return true;
  const c = inv.client || {};
  return [c.name, c.email, c.company, inv.number].some((v) => String(v || "").toLowerCase().includes(needle));
}

/** Counts per list chip (after client search, before the status filter). */
export function chipCounts(invoices, q = "") {
  const base = (invoices || []).filter((i) => i.status !== "deleted" && matchesClientSearch(i, q));
  const out = {};
  for (const c of LIST_CHIPS) out[c] = filterInvoices(base, { status: c }).length;
  return out;
}

/** Which quick actions a row offers. */
export function rowActions(inv) {
  switch (inv?.status) {
    case "draft": return ["edit", "send", "delete"];
    case "open": case "overdue": return ["copyLink", "resend", "void"];
    case "paid": return ["receipt"];
    case "void": return ["delete"];
    default: return [];
  }
}

/** Due date for a due chip: "receipt" = today, else N days from today (YYYY-MM-DD, UTC). */
export function dueDateForChip(chip, now = new Date()) {
  const days = chip === "receipt" ? 0 : Number(chip);
  return new Date(now.getTime() + (Number.isFinite(days) ? days : DEFAULT_DUE_DAYS) * 86400000).toISOString().slice(0, 10);
}

/** Client-side check before Send: positive total, every line has a positive amount and qty. */
export function composerProblems({ lines = [], clientEmail } = {}) {
  const problems = [];
  if (!clientEmail) problems.push("Pick a client");
  if (!lines.length) problems.push("Add a product");
  lines.forEach((l, i) => {
    if (l.custom && !String(l.description || "").trim()) problems.push(`Line ${i + 1}: describe the custom item`);
    if (!(Number(l.amountCents) > 0)) problems.push(`Line ${i + 1}: amount must be more than $0`);
    if (!(Number.isInteger(Number(l.quantity)) && Number(l.quantity) >= 1)) problems.push(`Line ${i + 1}: quantity must be at least 1`);
  });
  const total = lines.reduce((s, l) => s + Math.round(Number(l.amountCents) || 0) * (Number(l.quantity) || 0), 0);
  if (lines.length && total <= 0) problems.push("Total must be more than $0");
  return problems;
}

/* ---------- Invoice recipients (portal users or AI clients) ---------- */
/** "ai:<portalClientId>" for AI clients, a users.id uuid for portal clients. */
export const AI_REF_PREFIX = "ai:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AI_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const EMAIL_REF_PREFIX = "email:";
const EMAIL_RE = /^[^\s@,;<>()"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
export const isValidEmail = (e) => EMAIL_RE.test(String(e || "").trim());
export const emailRecipientRef = (e) => `${EMAIL_REF_PREFIX}${String(e).trim().toLowerCase()}`;
export function parseRecipientRef(ref) {
  const s = String(ref || "").trim();
  if (s.startsWith(EMAIL_REF_PREFIX)) { const e = s.slice(EMAIL_REF_PREFIX.length).toLowerCase(); return isValidEmail(e) ? { kind: "email", id: e } : null; }
  if (s.startsWith(AI_REF_PREFIX)) { const id = s.slice(AI_REF_PREFIX.length); return AI_ID_RE.test(id) ? { kind: "ai", id } : null; }
  return UUID_RE.test(s) ? { kind: "user", id: s } : null;
}
export const aiRecipientRef = (id) => `${AI_REF_PREFIX}${id}`;
/**
 * Why this recipient can't be invoiced, or null. Admin user accounts (role admin or admin email)
 * are refused; AI clients and one-time typed emails are not user rows, so they're allowed.
 */
export function recipientRefusal(r, isAdminEmail = () => false) {
  if (!r) return "Client not found";
  if ((!r.kind || r.kind === "user") && (r.role === "admin" || isAdminEmail(r.email))) return "Admins can't be invoiced. Pick a client.";
  if (!r.email) return "This client has no email address to send the invoice to";
  return null;
}
/** Users-list rows that get a "New invoice" action: client accounts only (legacy "user" role counts as client). */
export const canInvoiceUserRow = (u) => Boolean(u && (u.id || u._id) && !u.isPendingInvitation && (u.role === "client" || u.role === "user") && !/@sleepysquid\.com$/i.test(String(u.email || "")));
export const canInvoiceAiRow = (c) => Boolean(c && c.id && !c.deleted_at && (c.emails || []).length > 0);
/** Show "+ Invoice <email>" when the typed text is an email that matches no listed client. */
export function oneTimeEmailOffer(q, results = []) {
  const e = String(q || "").trim().toLowerCase();
  if (!isValidEmail(e)) return null;
  return results.some((r) => String(r.email || "").toLowerCase() === e) ? null : e;
}

/** Add a catalog product to composer lines: picking one already on the invoice bumps its qty by 1. */
export function addProductLine(lines, p, key) {
  const i = lines.findIndex((l) => !l.custom && l.priceId === p.priceId);
  if (i >= 0) return lines.map((l, j) => (j === i ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l));
  return [...lines, { key, priceId: p.priceId, description: p.product.name, amount: (p.unitAmount / 100).toFixed(2), quantity: "1", currency: p.currency }];
}
