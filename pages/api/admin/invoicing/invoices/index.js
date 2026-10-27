import { requireAdmin } from "@/libs/adminRequest";
import { listClient, publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";
import { aiClientsByIds } from "@/libs/invoicing/recipients";
import { BUSINESS_LINES, STATUS_FILTERS, chipCounts, filterInvoices, matchesClientSearch, isMissingSchemaError, NOT_MIGRATED_MESSAGE } from "@/libs/invoicing/core.mjs";
import { invoicingMode } from "@/libs/invoicing/stripeInvoices.mjs";
import { listAllInvoices } from "@/libs/db/invoices";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET"]);
  if (!session) return;
  const status = STATUS_FILTERS.includes(String(req.query.status)) ? String(req.query.status) : "all";
  const q = String(req.query.q || "").slice(0, 100);
  const line = BUSINESS_LINES.includes(String(req.query.line)) ? String(req.query.line) : "all";
  try {
    const rows = await listAllInvoices();
    let aiById = {};
    try { aiById = await aiClientsByIds(rows.map((r) => r.ai_client_id)); } catch (e) { console.error("AI client names:", e?.message); }
    const all = rows.map((r) => ({ ...publicInvoice(r), client: listClient(r, aiById) }));
    const byLine = filterInvoices(all, { line });
    const invoices = filterInvoices(byLine.filter((i) => matchesClientSearch(i, q)), { status });
    return res.status(200).json({ success: true, data: { mode: invoicingMode(), migrated: true, invoices, counts: chipCounts(byLine, q), filters: { status, line, q } } });
  } catch (error) {
    if (isMissingSchemaError(error)) return res.status(200).json({ success: true, data: { mode: invoicingMode(), migrated: false, notice: NOT_MIGRATED_MESSAGE, invoices: [], counts: chipCounts([]), filters: { status, line, q } } });
    console.error("List all invoices error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not load invoices" });
  }
}
