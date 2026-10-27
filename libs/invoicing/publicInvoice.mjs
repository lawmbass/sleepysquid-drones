import { displayStatus } from "./core.mjs";

export function publicInvoice(row) {
  return {
    id: row.id, stripeInvoiceId: row.stripe_invoice_id, number: row.number, status: displayStatus(row), rawStatus: row.status,
    livemode: row.livemode, currency: row.currency, totalCents: Number(row.total_cents), amountDueCents: Number(row.amount_due_cents),
    dueDate: row.due_date, memo: row.memo, hostedInvoiceUrl: row.hosted_invoice_url, invoicePdf: row.invoice_pdf,
    approvedTotalCents: row.approved_total_cents == null ? null : Number(row.approved_total_cents),
    lastPaymentError: row.last_payment_error, sentAt: row.sent_at, createdAt: row.created_at, businessLines: row.business_lines || [],
    recipientKind: row.user_id ? "user" : row.ai_client_id ? "ai" : row.recipient_email ? "email" : "user",
  };
}


/** List-row client for any recipient kind. aiById: { [ai_client_id]: { id, name, email } }. */
export function listClient(row, aiById = {}) {
  if (row.client) return { id: row.client.id, name: row.client.name, email: row.client.email, company: row.client.company, kind: "user" };
  if (row.ai_client_id) return aiById[row.ai_client_id] || { id: `ai:${row.ai_client_id}`, name: row.ai_client_id, email: null, kind: "ai" };
  if (row.recipient_email) return { id: `email:${row.recipient_email}`, name: row.recipient_name || null, email: row.recipient_email, kind: "email" };
  return null;
}
