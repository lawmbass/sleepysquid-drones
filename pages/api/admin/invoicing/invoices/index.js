import { requireAdmin } from "@/libs/adminRequest";
import { publicInvoice } from "@/libs/invoicing/publicInvoice.mjs";
import { BUSINESS_LINES, STATUS_FILTERS, filterInvoices, isMissingSchemaError, NOT_MIGRATED_MESSAGE } from "@/libs/invoicing/core.mjs";
import { invoicingMode } from "@/libs/invoicing/stripeInvoices.mjs";
import { listAllInvoices } from "@/libs/db/invoices";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET"]);
  if (!session) return;
  const status = STATUS_FILTERS.includes(String(req.query.status)) ? String(req.query.status) : "all";
  const line = BUSINESS_LINES.includes(String(req.query.line)) ? String(req.query.line) : "all";
  try {
    const rows = await listAllInvoices();
    const invoices = filterInvoices(rows.map((r) => ({ ...publicInvoice(r), client: r.client ? { id: r.client.id, name: r.client.name, email: r.client.email, company: r.client.company } : null })), { status, line });
    return res.status(200).json({ success: true, data: { mode: invoicingMode(), migrated: true, invoices, filters: { status, line } } });
  } catch (error) {
    if (isMissingSchemaError(error)) return res.status(200).json({ success: true, data: { mode: invoicingMode(), migrated: false, notice: NOT_MIGRATED_MESSAGE, invoices: [], filters: { status, line } } });
    console.error("List all invoices error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not load invoices" });
  }
}
