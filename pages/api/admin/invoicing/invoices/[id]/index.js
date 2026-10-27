import { requireAdmin } from "@/libs/adminRequest";
import { deleteInvoiceFlow, idempotencyKey } from "@/libs/invoicing/core.mjs";
import { createStripeClient, getInvoice, invoicingWritesAllowed } from "@/libs/invoicing/stripeInvoices.mjs";
import { deleteInvoiceRow, findInvoiceById, writeAudit } from "@/libs/db/invoices";

/**
 * DELETE /api/admin/invoicing/invoices/:id  body { confirm: "DELETE" }
 * Removes a void or draft invoice from the hub database. Any other status is refused server-side.
 * Drafts are deleted in Stripe too; void invoices stay in Stripe as a $0 voided record.
 */
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["DELETE"]);
  if (!session) return;
  if (req.body?.confirm !== "DELETE") return res.status(400).json({ error: "Confirm required", message: "Confirm to delete" });
  try {
    const row = await findInvoiceById(String(req.query.id || ""));
    const stripe = createStripeClient();
    const result = await deleteInvoiceFlow(row, {
      getStripeInvoice: (id) => getInvoice(stripe, id),
      deleteStripeDraft: (id) => stripe.call("DELETE", `/invoices/${encodeURIComponent(id)}`, undefined, { idempotency: idempotencyKey("delete", id) }),
      deleteRow: deleteInvoiceRow,
      writeAudit,
      actorEmail: session.user.email,
      stripeWritesAllowed: invoicingWritesAllowed(),
    });
    if (!result.ok) return res.status(result.status).json({ error: "Cannot delete", message: result.message });
    return res.status(200).json({ success: true, data: { deleted: true, stripeDraftDeleted: result.stripeDraftDeleted } });
  } catch (error) {
    console.error("Delete invoice error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not delete the invoice" });
  }
}
