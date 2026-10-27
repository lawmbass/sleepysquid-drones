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
    if (!(Number(l.amountCents) > 0)) problems.push(`Line ${i + 1}: amount must be more than $0`);
    if (!(Number.isInteger(Number(l.quantity)) && Number(l.quantity) >= 1)) problems.push(`Line ${i + 1}: quantity must be at least 1`);
  });
  const total = lines.reduce((s, l) => s + Math.round(Number(l.amountCents) || 0) * (Number(l.quantity) || 0), 0);
  if (lines.length && total <= 0) problems.push("Total must be more than $0");
  return problems;
}
